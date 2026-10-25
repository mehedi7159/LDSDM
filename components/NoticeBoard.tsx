import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NoticeItem, NoticeCategory, NoticePriority, NoticeTarget } from '../types';
import { 
  Megaphone, 
  AlertTriangle, 
  AlertCircle, 
  Calendar, 
  Clock, 
  Pin, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Volume2, 
  VolumeX, 
  Eye, 
  Printer, 
  Sparkles, 
  ShieldAlert, 
  Users, 
  BookOpen, 
  CalendarCheck,
  Pause,
  Play,
  ArrowRight,
  Info,
  Radio
} from 'lucide-react';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { NOTICES_CLOUD_FAILURE_MESSAGE, NOTICE_DELETE_CLOUD_FAILURE_MESSAGE, RETRY_LABEL } from '../services/cloudConfirm';

// =========================================================================
// HELPER: Category & Priority Badges and Styles
// =========================================================================
export const getNoticeBadgeConfig = (category: NoticeCategory, priority: NoticePriority, language: string = 'bn') => {
  const isBn = language === 'bn';

  let categoryLabel = isBn ? 'সাধারণ বিজ্ঞপ্তি' : 'General Notice';
  let categoryBg = 'bg-blue-50 text-blue-700 border-blue-200';
  let icon = Megaphone;

  switch (category) {
    case 'cancellation':
      categoryLabel = isBn ? '🚫 ক্লাস বাতিল / পরিবর্তন' : '🚫 Class Cancellation';
      categoryBg = 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
      icon = AlertTriangle;
      break;
    case 'urgent':
      categoryLabel = isBn ? '🚨 জরুরি আপডেট' : '🚨 Urgent Update';
      categoryBg = 'bg-red-50 text-red-800 border-red-300 font-bold';
      icon = AlertCircle;
      break;
    case 'exam':
      categoryLabel = isBn ? '📝 পরীক্ষার নোটিশ' : '📝 Exam Notification';
      categoryBg = 'bg-indigo-50 text-indigo-800 border-indigo-200 font-bold';
      icon = BookOpen;
      break;
    case 'holiday':
      categoryLabel = isBn ? '📅 ছুটির নোটিশ' : '📅 Holiday Notice';
      categoryBg = 'bg-purple-50 text-purple-800 border-purple-200 font-semibold';
      icon = CalendarCheck;
      break;
    case 'event':
      categoryLabel = isBn ? '✨ অনুষ্ঠান / মাহফিল' : '✨ Event / Mahfil';
      categoryBg = 'bg-amber-50 text-amber-900 border-amber-300 font-semibold';
      icon = Sparkles;
      break;
    case 'diary':
      categoryLabel = isBn ? '📖 দৈনিক ডায়েরি' : '📖 Daily Diary';
      categoryBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      icon = BookOpen;
      break;
    default:
      categoryLabel = isBn ? '📢 সাধারণ নোটিশ' : '📢 General Notice';
      categoryBg = 'bg-slate-100 text-slate-800 border-slate-200';
      icon = Megaphone;
  }

  let priorityLabel = isBn ? 'সাধারণ' : 'Normal';
  let priorityBadge = 'bg-slate-100 text-slate-600 border-slate-200';

  if (priority === 'urgent') {
    priorityLabel = isBn ? 'সর্বোচ্চ জরুরি' : 'Urgent';
    priorityBadge = 'bg-rose-600 text-white border-rose-700 font-black animate-pulse';
  } else if (priority === 'important') {
    priorityLabel = isBn ? 'গুরুত্বপূর্ণ' : 'Important';
    priorityBadge = 'bg-amber-500 text-white border-amber-600 font-bold';
  }

  return { categoryLabel, categoryBg, priorityLabel, priorityBadge, icon };
};

// =========================================================================
// SUB-COMPONENT: NOTICE BOARD MARQUEE & TOP NOTIFICATION ALERT BANNER
// (Renders right at the top of the Dashboard for all users)
// =========================================================================
interface NoticeBoardAlertBannerProps {
  onOpenNoticeBoard?: () => void;
  className?: string;
}

export const NoticeBoardAlertBanner: React.FC<NoticeBoardAlertBannerProps> = ({
  onOpenNoticeBoard,
  className = ''
}) => {
  const { notices = [], language, isAdmin, isSuperAdmin, authUser, addNotice, confirmNoticesCloudSync, classes = [] } = useApp();
  const isOwnerAdmin = isSuperAdmin || (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const canManage = isOwnerAdmin || isAdmin;
  const isBn = language === 'bn';

  // Session-based dismissed alert IDs
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('mms_dismissed_notice_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeAlertIndex, setActiveAlertIndex] = useState(0);
  // Truthful-save Step 2-বাকি: quick-post failure state (modal stays
  // open, retry re-confirms only).
  const [quickPostError, setQuickPostError] = useState<string | null>(null);
  const [pendingQuickPost, setPendingQuickPost] = useState<NoticeItem[] | null>(null);
  const [selectedNoticeForModal, setSelectedNoticeForModal] = useState<NoticeItem | null>(null);
  const [isMarqueePaused, setIsMarqueePaused] = useState(false);
  const [isQuickPostOpen, setIsQuickPostOpen] = useState(false);

  // Quick Post Form States
  const [quickTitle, setQuickTitle] = useState('');
  const [quickContent, setQuickContent] = useState('');
  const [quickCategory, setQuickCategory] = useState<NoticeCategory>('urgent');
  const [quickPriority, setQuickPriority] = useState<NoticePriority>('urgent');
  const [quickTargetClass, setQuickTargetClass] = useState('');

  // 1. High-Priority Alert Notices (Urgent updates, class cancellations, exam notifications)
  const alertNotices = useMemo(() => {
    return notices
      .filter(n => {
        if (n.isActive === false) return false;
        if (dismissedIds.includes(n.id)) return false;
        // Priority alert conditions
        const isUrgent = n.priority === 'urgent' || n.category === 'urgent';
        const isCancellation = n.category === 'cancellation';
        const isExam = n.category === 'exam';
        const isAlertBanner = n.showAlertBanner !== false;
        return isAlertBanner && (isUrgent || isCancellation || isExam || n.isPinned);
      })
      .sort((a, b) => {
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
        if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
        return new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime();
      });
  }, [notices, dismissedIds]);

  // 2. Marquee Ticker Notices (All active notices enabled for marquee)
  const marqueeNotices = useMemo(() => {
    return notices
      .filter(n => n.isActive !== false && n.showMarquee !== false)
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime();
      });
  }, [notices]);

  // Current active alert notice in banner carousel
  const currentAlertNotice = alertNotices[activeAlertIndex] || alertNotices[0];

  const handleDismissAlert = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      sessionStorage.setItem('mms_dismissed_notice_alerts', JSON.stringify(updated));
    } catch {}
    if (activeAlertIndex >= alertNotices.length - 1) {
      setActiveAlertIndex(0);
    }
  };

  const handleNextAlert = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveAlertIndex(prev => (prev + 1) % alertNotices.length);
  };

  const handlePrevAlert = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveAlertIndex(prev => (prev - 1 + alertNotices.length) % alertNotices.length);
  };

  const handleQuickPostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !quickContent.trim()) return;

    const created = addNotice({
      title: quickTitle.trim(),
      content: quickContent.trim(),
      category: quickCategory,
      priority: quickPriority,
      target: quickTargetClass ? 'class' : 'all',
      targetClass: quickTargetClass || undefined,
      date: new Date().toISOString().split('T')[0],
      isPinned: true,
      isActive: true,
      showMarquee: true,
      showAlertBanner: true,
      authorName: authUser?.displayName || (isBn ? 'অধ্যক্ষ কার্যালয়' : 'Principal Office'),
      authorRole: isBn ? 'অধ্যক্ষ / প্রশাসন' : 'Principal / Admin'
    });

    // Truthful-save Step 2-বাকি: modal closes only after the cloud
    // write lands; failure keeps the form (nothing is lost) + retry.
    const result = await confirmNoticesCloudSync([created, ...notices]);
    if (!result.success) {
      setQuickPostError(result.message || NOTICES_CLOUD_FAILURE_MESSAGE);
      setPendingQuickPost([created, ...notices]);
      return;
    }
    setQuickPostError(null);
    setPendingQuickPost(null);

    setQuickTitle('');
    setQuickContent('');
    setQuickCategory('urgent');
    setQuickPriority('urgent');
    setQuickTargetClass('');
    setIsQuickPostOpen(false);
  };

  // Retry re-confirms the last failed quick post (never re-posts).
  const handleRetryQuickPostConfirm = async () => {
    if (!pendingQuickPost) return;
    const result = await confirmNoticesCloudSync(pendingQuickPost);
    if (result.success) {
      setQuickPostError(null);
      setPendingQuickPost(null);
      setQuickTitle('');
      setQuickContent('');
      setQuickCategory('urgent');
      setQuickPriority('urgent');
      setQuickTargetClass('');
      setIsQuickPostOpen(false);
    } else {
      setQuickPostError(result.message || NOTICES_CLOUD_FAILURE_MESSAGE);
    }
  };

  // If no notices are available at all, return null
  if (alertNotices.length === 0 && marqueeNotices.length === 0 && !canManage) {
    return null;
  }

  return (
    <div className={`space-y-2.5 print:hidden ${className} ${isBn ? 'font-bangla' : ''}`}>
      
      {/* ============================================================== */}
      {/* 1. TOP EMERGENCY / NOTIFICATION ALERT BANNER                   */}
      {/* ============================================================== */}
      {currentAlertNotice && (
        <div 
          onClick={() => setSelectedNoticeForModal(currentAlertNotice)}
          className={`relative rounded-2xl p-3 sm:p-3.5 border shadow-md transition-all cursor-pointer group overflow-hidden ${
            currentAlertNotice.category === 'cancellation'
              ? 'bg-gradient-to-r from-rose-950 via-rose-900 to-red-950 text-white border-rose-600/80 shadow-rose-950/30'
              : currentAlertNotice.priority === 'urgent'
              ? 'bg-gradient-to-r from-red-950 via-red-900 to-slate-950 text-white border-red-600/80 shadow-red-950/30'
              : currentAlertNotice.category === 'exam'
              ? 'bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-950 text-white border-indigo-500/80 shadow-indigo-950/30'
              : 'bg-gradient-to-r from-amber-950 via-amber-900 to-slate-950 text-white border-amber-500/80 shadow-amber-950/30'
          }`}
        >
          {/* Subtle Ambient Pulse Light */}
          <div className="absolute top-0 right-0 w-64 h-full bg-white/5 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Left: Icon & Notice Headline */}
            <div className="flex items-start sm:items-center gap-3">
              {/* Alert Pulsing Icon */}
              <div className={`p-2 rounded-xl shrink-0 flex items-center justify-center font-bold ${
                currentAlertNotice.category === 'cancellation'
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40'
                  : currentAlertNotice.priority === 'urgent'
                  ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/40'
                  : currentAlertNotice.category === 'exam'
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/40'
                  : 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/40'
              }`}>
                {currentAlertNotice.category === 'cancellation' ? <AlertTriangle size={18} /> :
                 currentAlertNotice.category === 'exam' ? <BookOpen size={18} /> :
                 <AlertCircle size={18} />}
              </div>

              {/* Text Information */}
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    currentAlertNotice.category === 'cancellation'
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-400/50'
                      : currentAlertNotice.category === 'exam'
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/50'
                      : 'bg-amber-400/30 text-amber-200 border border-amber-300/50'
                  }`}>
                    {currentAlertNotice.category === 'cancellation'
                      ? (isBn ? 'ক্লাস বাতিল / পরিবর্তন' : 'Class Cancellation')
                      : currentAlertNotice.category === 'exam'
                      ? (isBn ? 'পরীক্ষার নোটিশ' : 'Exam Notification')
                      : (isBn ? 'জরুরি প্রাতিষ্ঠানিক আপডেট' : 'Urgent Alert')}
                  </span>

                  {currentAlertNotice.targetClass && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white/20 text-white">
                      {isBn ? `শ্রেণি: ${currentAlertNotice.targetClass}` : `Class: ${currentAlertNotice.targetClass}`}
                    </span>
                  )}

                  <span className="text-[11px] text-slate-300 font-mono">
                    {currentAlertNotice.date || currentAlertNotice.createdAt.split('T')[0]}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-200 transition-colors line-clamp-1">
                    {currentAlertNotice.title}
                  </h4>
                </div>
              </div>
            </div>

            {/* Right: Actions, Pager & Dismiss */}
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t border-white/10 sm:border-0" onClick={(e) => e.stopPropagation()}>
              
              {/* Alert Pager when multiple exist */}
              {alertNotices.length > 1 ? (
                <div className="flex items-center gap-1 bg-black/30 rounded-xl px-2 py-1 text-[11px] font-mono text-slate-300">
                  <button 
                    onClick={handlePrevAlert} 
                    className="p-0.5 hover:text-white transition cursor-pointer"
                    title={isBn ? 'পূর্ববর্তী অ্যালার্ট' : 'Previous'}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span>{activeAlertIndex + 1}/{alertNotices.length}</span>
                  <button 
                    onClick={handleNextAlert} 
                    className="p-0.5 hover:text-white transition cursor-pointer"
                    title={isBn ? 'পরবর্তী অ্যালার্ট' : 'Next'}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : <div className="hidden sm:block" />}

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* View Details Button */}
                <button
                  onClick={() => setSelectedNoticeForModal(currentAlertNotice)}
                  className="px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-white/20 active:scale-95"
                >
                  <span>{isBn ? 'বিস্তারিত' : 'Details'}</span>
                  <ArrowRight size={12} />
                </button>

                {/* Dismiss Button */}
                <button
                  onClick={(e) => handleDismissAlert(currentAlertNotice.id, e)}
                  className="p-1 rounded-lg bg-black/20 hover:bg-black/40 text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
                  title={isBn ? 'বন্ধ করুন' : 'Dismiss Alert'}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CONTINUOUS NOTIFICATION MARQUEE TICKER                      */}
      {/* ============================================================== */}
      {marqueeNotices.length > 0 && (
        <div className="bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 shadow-sm overflow-hidden flex items-stretch">
          
          {/* Ticker Lead-in Label */}
          <div className="bg-indigo-600 text-white px-3 sm:px-4 py-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider shrink-0 z-10 shadow-md">
            <Radio size={14} className="animate-pulse text-amber-300" />
            <span className="hidden sm:inline">{isBn ? 'জরুরি সংবাদ ও নোটিশ' : 'Live Updates'}</span>
            <span className="sm:hidden">{isBn ? 'সংবাদ' : 'Live'}</span>
          </div>

          {/* Marquee Scrolling Stage */}
          <div 
            className="flex-1 overflow-hidden relative flex items-center py-1.5 px-3"
            onMouseEnter={() => setIsMarqueePaused(true)}
            onMouseLeave={() => setIsMarqueePaused(false)}
          >
            <div 
              className={`flex items-center gap-8 whitespace-nowrap text-xs ${
                isMarqueePaused ? '' : 'animate-marquee'
              }`}
              style={{
                animationDuration: `${Math.max(20, marqueeNotices.length * 10)}s`
              }}
            >
              {marqueeNotices.map((n, idx) => {
                const isUrgent = n.priority === 'urgent' || n.category === 'urgent' || n.category === 'cancellation';
                return (
                  <div
                    key={n.id || idx}
                    onClick={() => setSelectedNoticeForModal(n)}
                    className="inline-flex items-center gap-2 cursor-pointer hover:text-indigo-400 transition-colors group"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      n.category === 'cancellation' ? 'bg-rose-900/80 text-rose-200 border border-rose-700' :
                      n.category === 'urgent' ? 'bg-red-900/80 text-red-200 border border-red-700' :
                      n.category === 'exam' ? 'bg-indigo-900/80 text-indigo-200 border border-indigo-700' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {n.category === 'cancellation' ? (isBn ? 'ক্লাস বাতিল' : 'Cancelled') :
                       n.category === 'urgent' ? (isBn ? 'জরুরি' : 'Urgent') :
                       n.category === 'exam' ? (isBn ? 'পরীক্ষা' : 'Exam') :
                       (isBn ? 'নোটিশ' : 'Notice')}
                    </span>

                    <span className={`font-semibold ${isUrgent ? 'text-amber-300 font-bold' : 'text-slate-200'}`}>
                      {n.title}
                    </span>

                    <span className="text-[10px] text-slate-500 font-mono">
                      ({n.date || n.createdAt.split('T')[0]})
                    </span>

                    <span className="text-slate-600 pl-4">•</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Marquee Controls & Admin Quick Action */}
          <div className="flex items-center gap-1 px-2.5 bg-slate-950/80 border-l border-slate-800 text-slate-400 shrink-0 z-10">
            <button
              onClick={() => setIsMarqueePaused(!isMarqueePaused)}
              className="p-1 hover:text-white transition cursor-pointer"
              title={isMarqueePaused ? (isBn ? 'চালান' : 'Play') : (isBn ? 'থামান' : 'Pause')}
            >
              {isMarqueePaused ? <Play size={13} /> : <Pause size={13} />}
            </button>

            {canManage && (
              <button
                onClick={() => setIsQuickPostOpen(true)}
                className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs ml-1"
                title={isBn ? 'নতুন জরুরি নোটিশ পোস্ট করুন' : 'Post Urgent Update'}
              >
                <Plus size={12} />
                <span className="hidden md:inline">{isBn ? 'পোস্ট' : 'Post'}</span>
              </button>
            )}

            {onOpenNoticeBoard && (
              <button
                onClick={onOpenNoticeBoard}
                className="p-1 hover:text-white transition cursor-pointer text-indigo-400"
                title={isBn ? 'পূর্ণাঙ্গ নোটিশ বোর্ড' : 'All Notices'}
              >
                <ArrowRight size={13} />
              </button>
            )}
          </div>

        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: VIEW FULL NOTICE DETAILS                              */}
      {/* ============================================================== */}
      {selectedNoticeForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
                  <Megaphone size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {isBn ? 'বিজ্ঞপ্তি ও নোটিশ বিবরণী' : 'Official Notice Details'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: #{selectedNoticeForModal.id.substring(0, 12)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedNoticeForModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              
              {/* Category & Status Pills */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${
                    getNoticeBadgeConfig(selectedNoticeForModal.category, selectedNoticeForModal.priority, language).categoryBg
                  }`}>
                    {getNoticeBadgeConfig(selectedNoticeForModal.category, selectedNoticeForModal.priority, language).categoryLabel}
                  </span>

                  {selectedNoticeForModal.priority === 'urgent' && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-600 text-white animate-pulse">
                      {isBn ? 'সর্বোচ্চ জরুরি' : 'URGENT'}
                    </span>
                  )}
                </div>

                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Calendar size={13} /> {selectedNoticeForModal.date || selectedNoticeForModal.createdAt.split('T')[0]}
                </span>
              </div>

              {/* Title */}
              <div>
                <h2 className="text-lg font-black text-slate-900 leading-snug">
                  {selectedNoticeForModal.title}
                </h2>
                {selectedNoticeForModal.targetClass && (
                  <p className="text-xs text-indigo-600 font-bold mt-1">
                    {isBn ? `প্রযোজ্য শ্রেণি: ${selectedNoticeForModal.targetClass}` : `Target Class: ${selectedNoticeForModal.targetClass}`}
                  </p>
                )}
              </div>

              {/* Content Description */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-bangla shadow-inner">
                {selectedNoticeForModal.content}
              </div>

              {/* Author & Footer Meta */}
              <div className="pt-2 flex flex-wrap justify-between items-center text-xs text-slate-500 border-t border-slate-100">
                <div>
                  <span>{isBn ? 'কর্তৃপক্ষ: ' : 'Issued By: '}</span>
                  <strong className="text-slate-800">{selectedNoticeForModal.authorName || (isBn ? 'অধ্যক্ষ' : 'Principal')}</strong>
                  {selectedNoticeForModal.authorRole && (
                    <span className="text-slate-400"> ({selectedNoticeForModal.authorRole})</span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400">
                  {selectedNoticeForModal.target === 'all' ? (isBn ? 'সকলের জন্য' : 'All Users') :
                   selectedNoticeForModal.target === 'students' ? (isBn ? 'শিক্ষার্থী ও অভিভাবক' : 'Students & Guardians') :
                   selectedNoticeForModal.target === 'teachers' ? (isBn ? 'শিক্ষক ও স্টাফ' : 'Faculty & Staff') :
                   (isBn ? `শ্রেণি: ${selectedNoticeForModal.targetClass}` : `Class: ${selectedNoticeForModal.targetClass}`)}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer size={14} />
                <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
              </button>

              <Button
                onClick={() => setSelectedNoticeForModal(null)}
                className="px-5 py-2 text-xs font-bold"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ADMIN QUICK POST NOTICE MODAL                         */}
      {/* ============================================================== */}
      {isQuickPostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-red-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-amber-400 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {isBn ? 'জরুরি আপডেট বা নোটিশ পোস্ট করুন' : 'Post Urgent Update or Notice'}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {isBn ? 'ড্যাশবোর্ডের শীর্ষ ব্যানার ও চলমান মারকুইতে তাৎক্ষণিক প্রদর্শিত হবে' : 'Appears immediately as a marquee & top alert for all users'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickPostOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickPostSubmit} className="p-6 space-y-4">
              
              {/* Title */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isBn ? 'শিরোনাম *' : 'Notice Headline *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isBn ? 'যেমন: তীব্র ঠান্ডার কারণে আগামীকালের ক্লাস স্থগিত' : 'e.g. Severe weather: Classes cancelled tomorrow'}
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-bangla font-semibold"
                  autoFocus
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isBn ? 'ধরণ (Category)' : 'Category'}
                  </label>
                  <select
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value as NoticeCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="urgent">{isBn ? '🚨 জরুরি আপডেট' : 'Urgent Update'}</option>
                    <option value="cancellation">{isBn ? '🚫 ক্লাস বাতিল / স্থগিত' : 'Class Cancellation'}</option>
                    <option value="exam">{isBn ? '📝 পরীক্ষার নোটিশ' : 'Exam Notification'}</option>
                    <option value="holiday">{isBn ? '📅 ছুটির ঘোষণা' : 'Holiday Notice'}</option>
                    <option value="general">{isBn ? '📢 সাধারণ বিজ্ঞপ্তি' : 'General Notice'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isBn ? 'অগ্রাধিকার (Priority)' : 'Priority'}
                  </label>
                  <select
                    value={quickPriority}
                    onChange={(e) => setQuickPriority(e.target.value as NoticePriority)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="urgent">{isBn ? 'সর্বোচ্চ জরুরি (Urgent)' : 'Urgent Alert'}</option>
                    <option value="important">{isBn ? 'গুরুত্বপূর্ণ (Important)' : 'Important'}</option>
                    <option value="normal">{isBn ? 'সাধারণ (Normal)' : 'Normal'}</option>
                  </select>
                </div>
              </div>

              {/* Specific Class Option (Useful for class cancellations) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isBn ? 'নির্দিষ্ট শ্রেণি (যদি প্রযোজ্য হয়)' : 'Target Class (Optional)'}
                </label>
                <select
                  value={quickTargetClass}
                  onChange={(e) => setQuickTargetClass(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800"
                >
                  <option value="">{isBn ? 'সকল শ্রেণি ও শিক্ষার্থীর জন্য' : 'All Classes & Students'}</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Detailed Body */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isBn ? 'বিস্তারিত ঘোষণা / নোটিশের বিবরণ *' : 'Notice Body / Details *'}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={isBn ? 'বিজ্ঞপ্তির বিস্তারিত এখানে লিখুন...' : 'Write the detailed announcement here...'}
                  value={quickContent}
                  onChange={(e) => setQuickContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-bangla"
                />
              </div>

              {/* Truthful-save Step 2-বাকি: cloud-failure notice (form stays, retry re-confirms only) */}
              {quickPostError && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <div className="flex-1 text-xs font-bold leading-relaxed">{quickPostError}</div>
                  {pendingQuickPost && (
                    <button
                      type="button"
                      onClick={handleRetryQuickPostConfirm}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer"
                    >
                      {isBn ? RETRY_LABEL : 'Retry'}
                    </button>
                  )}
                </div>
              )}

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickPostOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/30 transition cursor-pointer"
                >
                  {isBn ? 'তাৎক্ষণিক প্রকাশ করুন' : 'Publish Immediately'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

// =========================================================================
// MAIN COMPONENT: NoticeBoard (Full Standalone Board & Admin Management)
// =========================================================================
interface NoticeBoardProps {
  onBack?: () => void;
}

export const NoticeBoard: React.FC<NoticeBoardProps> = ({ onBack }) => {
  const { 
    notices = [], 
    addNotice, 
    updateNotice, 
    deleteNotice, 
    togglePinNotice, 
    confirmNoticesCloudSync,
    isAdmin, 
    isSuperAdmin, 
    authUser, 
    language, 
    classes = [], 
    schoolProfile 
  } = useApp();

  const isOwnerAdmin = isSuperAdmin || (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const canManage = isOwnerAdmin || isAdmin;
  const isBn = language === 'bn';

  // Filters & State
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | NoticeCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
  const [noticeToDelete, setNoticeToDelete] = useState<NoticeItem | null>(null);
  const [selectedNoticeForModal, setSelectedNoticeForModal] = useState<NoticeItem | null>(null);
  // Truthful-save Step 2-বাকি: page banner + in-modal/dialog failure
  // states. Retry re-confirms the held list only (never re-applies).
  const [boardAction, setBoardAction] = useState<{ type: 'success' | 'error'; message: string; retry?: () => void } | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [pendingCompose, setPendingCompose] = useState<{ list: NoticeItem[]; successText: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ list: NoticeItem[]; id: string } | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<NoticeCategory>('urgent');
  const [formPriority, setFormPriority] = useState<NoticePriority>('urgent');
  const [formTarget, setFormTarget] = useState<NoticeTarget>('all');
  const [formTargetClass, setFormTargetClass] = useState<string>('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formShowMarquee, setFormShowMarquee] = useState(true);
  const [formShowAlertBanner, setFormShowAlertBanner] = useState(true);
  const [formAuthorName, setFormAuthorName] = useState(authUser?.displayName || (isBn ? 'অধ্যক্ষ কার্যালয়' : 'Principal Office'));
  const [formAuthorRole, setFormAuthorRole] = useState(isBn ? 'অধ্যক্ষ / সুপারিনটেনডেন্ট' : 'Principal');

  const openCompose = (noticeToEdit?: NoticeItem) => {
    if (noticeToEdit) {
      setEditingNotice(noticeToEdit);
      setFormTitle(noticeToEdit.title);
      setFormContent(noticeToEdit.content);
      setFormCategory(noticeToEdit.category);
      setFormPriority(noticeToEdit.priority);
      setFormTarget(noticeToEdit.target);
      setFormTargetClass(noticeToEdit.targetClass || '');
      setFormIsPinned(Boolean(noticeToEdit.isPinned));
      setFormShowMarquee(noticeToEdit.showMarquee !== false);
      setFormShowAlertBanner(noticeToEdit.showAlertBanner !== false);
      setFormAuthorName(noticeToEdit.authorName || (isBn ? 'অধ্যক্ষ কার্যালয়' : 'Principal Office'));
      setFormAuthorRole(noticeToEdit.authorRole || (isBn ? 'অধ্যক্ষ' : 'Principal'));
    } else {
      setEditingNotice(null);
      setFormTitle('');
      setFormContent('');
      setFormCategory('urgent');
      setFormPriority('urgent');
      setFormTarget('all');
      setFormTargetClass('');
      setFormIsPinned(false);
      setFormShowMarquee(true);
      setFormShowAlertBanner(true);
      setFormAuthorName(authUser?.displayName || (isBn ? 'অধ্যক্ষ কার্যালয়' : 'Principal Office'));
      setFormAuthorRole(isBn ? 'অধ্যক্ষ / সুপারিনটেনডেন্ট' : 'Principal');
    }
    setIsComposeModalOpen(true);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    // Truthful-save Step 2-বাকি: modal closes only after the cloud
    // write lands; failure keeps the form (nothing is lost) + retry.
    let nextNotices: NoticeItem[];
    let successText: string;
    if (editingNotice) {
      const stored = updateNotice({
        ...editingNotice,
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        priority: formPriority,
        target: formTarget,
        targetClass: formTarget === 'class' ? formTargetClass : undefined,
        isPinned: formIsPinned,
        showMarquee: formShowMarquee,
        showAlertBanner: formShowAlertBanner,
        authorName: formAuthorName.trim() || (isBn ? 'প্রশাসন' : 'Administration'),
        authorRole: formAuthorRole.trim() || undefined,
        updatedAt: new Date().toISOString()
      });
      nextNotices = notices.map(n => n.id === stored.id ? stored : n);
      successText = isBn ? 'নোটিশ আপডেট হয়েছে।' : 'Notice updated.';
    } else {
      const created = addNotice({
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        priority: formPriority,
        target: formTarget,
        targetClass: formTarget === 'class' ? formTargetClass : undefined,
        date: new Date().toISOString().split('T')[0],
        isPinned: formIsPinned,
        isActive: true,
        showMarquee: formShowMarquee,
        showAlertBanner: formShowAlertBanner,
        authorName: formAuthorName.trim() || (isBn ? 'প্রশাসন' : 'Administration'),
        authorRole: formAuthorRole.trim() || undefined
      });
      nextNotices = [created, ...notices];
      successText = isBn ? 'নোটিশ প্রকাশ হয়েছে।' : 'Notice published.';
    }

    const result = await confirmNoticesCloudSync(nextNotices);
    if (!result.success) {
      setComposeError(result.message || NOTICES_CLOUD_FAILURE_MESSAGE);
      setPendingCompose({ list: nextNotices, successText });
      return;
    }
    setComposeError(null);
    setPendingCompose(null);
    setBoardAction({ type: 'success', message: successText });
    setIsComposeModalOpen(false);
  };

  // Retry re-confirms the last failed compose list (never re-saves).
  const handleRetryComposeConfirm = async () => {
    if (!pendingCompose) return;
    const result = await confirmNoticesCloudSync(pendingCompose.list);
    if (result.success) {
      setComposeError(null);
      setPendingCompose(null);
      setBoardAction({ type: 'success', message: pendingCompose.successText });
      setIsComposeModalOpen(false);
    } else {
      setComposeError(result.message || NOTICES_CLOUD_FAILURE_MESSAGE);
    }
  };

  // Pin toggle with truthful-save: failure shows a banner + retry
  // (the pin flip itself stays local until it lands in cloud).
  const handleTogglePin = async (noticeId: string) => {
    const nextNotices = notices.map(n => n.id === noticeId ? { ...n, isPinned: !n.isPinned } : n);
    togglePinNotice(noticeId);
    const result = await confirmNoticesCloudSync(nextNotices);
    if (result.success) {
      setBoardAction({ type: 'success', message: isBn ? 'পিন আপডেট হয়েছে।' : 'Pin updated.' });
    } else {
      setBoardAction({
        type: 'error',
        message: result.message || NOTICES_CLOUD_FAILURE_MESSAGE,
        retry: () => handleTogglePinRetry()
      });
    }
  };

  // Pin retry re-confirms the current list (no-arg: fresh by retry time).
  const handleTogglePinRetry = async () => {
    const result = await confirmNoticesCloudSync();
    if (result.success) {
      setBoardAction({ type: 'success', message: isBn ? 'পিন আপডেট হয়েছে।' : 'Pin updated.' });
    } else {
      setBoardAction({
        type: 'error',
        message: result.message || NOTICES_CLOUD_FAILURE_MESSAGE,
        retry: () => handleTogglePinRetry()
      });
    }
  };

  // Delete confirm: dialog stays open on cloud failure, its confirm
  // button becomes the retry (re-confirm only, never re-deletes).
  const handleConfirmDelete = async () => {
    if (pendingDelete) {
      const result = await confirmNoticesCloudSync(pendingDelete.list);
      if (result.success) {
        setPendingDelete(null);
        setNoticeToDelete(null);
        setBoardAction({ type: 'success', message: isBn ? 'নোটিশ মুছে ফেলা হয়েছে।' : 'Notice deleted.' });
      } else {
        setBoardAction({ type: 'error', message: result.message || NOTICE_DELETE_CLOUD_FAILURE_MESSAGE });
      }
      return;
    }
    if (!noticeToDelete) return;
    const nextNotices = notices.filter(n => n.id !== noticeToDelete.id);
    deleteNotice(noticeToDelete.id);
    const result = await confirmNoticesCloudSync(nextNotices);
    if (result.success) {
      setNoticeToDelete(null);
      setBoardAction({ type: 'success', message: isBn ? 'নোটিশ মুছে ফেলা হয়েছে।' : 'Notice deleted.' });
    } else {
      setPendingDelete({ list: nextNotices, id: noticeToDelete.id });
      setBoardAction({ type: 'error', message: result.message || NOTICE_DELETE_CLOUD_FAILURE_MESSAGE });
    }
  };

  // Filtered Notices
  const filteredNotices = useMemo(() => {
    let list = [...notices];

    // Priority sorting: Pinned first, then newest
    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime();
    });

    if (activeCategoryFilter !== 'all') {
      list = list.filter(n => n.category === activeCategoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.targetClass && n.targetClass.toLowerCase().includes(q))
      );
    }

    return list;
  }, [notices, activeCategoryFilter, searchQuery]);

  // Quick statistics
  const urgentCount = notices.filter(n => n.priority === 'urgent' || n.category === 'urgent').length;
  const cancellationCount = notices.filter(n => n.category === 'cancellation').length;
  const examCount = notices.filter(n => n.category === 'exam').length;

  return (
    <div className={`space-y-6 pb-12 ${isBn ? 'font-bangla' : ''}`}>
      
      {/* 1. TOP MARQUEE & NOTIFICATION ALERT INTEGRATED BANNER */}
      <NoticeBoardAlertBanner />

      {/* Truthful-save Step 2-বাকি: page-level action banner */}
      {boardAction && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
          boardAction.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          {boardAction.type === 'success'
            ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            : <AlertTriangle size={18} className="text-amber-600 shrink-0" />}
          <div className="flex-1 text-xs font-bold leading-relaxed">{boardAction.message}</div>
          {boardAction.retry && (
            <button
              type="button"
              onClick={boardAction.retry}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer"
            >
              {isBn ? RETRY_LABEL : 'Retry'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setBoardAction(null)}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
            aria-label={isBn ? 'বন্ধ করুন' : 'Dismiss'}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. NOTICE BOARD HEADER & ACTION BAR */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-600/30 shrink-0">
            <Megaphone size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isBn ? 'নোটিশ বোর্ড ও জরুরি বার্তা কেন্দ্র' : 'Notice Board & Notification Center'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-200">
                {notices.length}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              {isBn ? '← ড্যাশবোর্ডে ফিরে যান' : '← Back to Dashboard'}
            </button>
          )}

          {canManage && (
            <button
              onClick={() => openCompose()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{isBn ? 'নতুন নোটিশ পোস্ট করুন' : 'Post Notice'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. QUICK STATS SUMMARY TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isBn ? 'মোট নোটিশ' : 'Total Notices'}</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{notices.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Megaphone size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider">{isBn ? 'জরুরি আপডেট' : 'Urgent Alerts'}</div>
            <div className="text-2xl font-black text-red-600 mt-1">{urgentCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold border border-red-200">
            <AlertCircle size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">{isBn ? 'ক্লাস বাতিল' : 'Cancellations'}</div>
            <div className="text-2xl font-black text-rose-600 mt-1">{cancellationCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold border border-rose-200">
            <AlertTriangle size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">{isBn ? 'পরীক্ষার নোটিশ' : 'Exam Notices'}</div>
            <div className="text-2xl font-black text-indigo-600 mt-1">{examCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-200">
            <BookOpen size={18} />
          </div>
        </div>
      </div>

      {/* 4. FILTER TABS & SEARCH BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeCategoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isBn ? 'সকল নোটিশ' : 'All'}
          </button>
          
          <button
            onClick={() => setActiveCategoryFilter('urgent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeCategoryFilter === 'urgent'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            {isBn ? '🚨 জরুরি আপডেট' : '🚨 Urgent'}
          </button>

          <button
            onClick={() => setActiveCategoryFilter('cancellation')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeCategoryFilter === 'cancellation'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            {isBn ? '🚫 ক্লাস বাতিল' : '🚫 Class Cancellations'}
          </button>

          <button
            onClick={() => setActiveCategoryFilter('exam')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeCategoryFilter === 'exam'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            {isBn ? '📝 পরীক্ষার নোটিশ' : '📝 Exam Notices'}
          </button>

          <button
            onClick={() => setActiveCategoryFilter('holiday')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeCategoryFilter === 'holiday'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            {isBn ? '📅 ছুটির নোটিশ' : '📅 Holidays'}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isBn ? 'নোটিশ খুঁজুন...' : 'Search notices...'}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 5. NOTICES CARDS GRID */}
      {filteredNotices.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={isBn ? 'কোনো নোটিশ পাওয়া যায়নি' : 'No notices match your filter'}
          description={isBn 
            ? 'এই ফিল্টারে কোনো বিজ্ঞপ্তি নেই।' 
            : 'No announcements in this category.'}
          actionLabel={canManage ? (isBn ? 'নতুন নোটিশ প্রকাশ করুন' : 'Post New Notice') : undefined}
          onAction={canManage ? () => openCompose() : undefined}
          actionIcon={Plus}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotices.map((notice) => {
            const badge = getNoticeBadgeConfig(notice.category, notice.priority, language);
            const isUrgent = notice.priority === 'urgent' || notice.category === 'urgent' || notice.category === 'cancellation';

            return (
              <div
                key={notice.id}
                onClick={() => setSelectedNoticeForModal(notice)}
                className={`rounded-3xl border p-5 transition-all cursor-pointer flex flex-col justify-between hover:shadow-lg group relative ${
                  notice.category === 'cancellation'
                    ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
                    : isUrgent
                    ? 'bg-red-50/30 border-red-200 hover:border-red-400'
                    : notice.category === 'exam'
                    ? 'bg-indigo-50/30 border-indigo-200 hover:border-indigo-400'
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div>
                  
                  {/* Meta Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${badge.categoryBg}`}>
                        {badge.categoryLabel}
                      </span>

                      {notice.isPinned && (
                        <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold">
                          <Pin size={10} className="fill-amber-600" />
                          <span>{isBn ? 'পিন' : 'Pinned'}</span>
                        </span>
                      )}

                      {notice.showMarquee !== false && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-semibold border border-slate-200">
                          {isBn ? 'মারকুই' : 'Marquee'}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {notice.date || notice.createdAt.split('T')[0]}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-black text-sm sm:text-base text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                    {notice.title}
                  </h3>

                  {notice.targetClass && (
                    <div className="text-[11px] font-bold text-indigo-600 mt-1">
                      {isBn ? `প্রযোজ্য শ্রেণি: ${notice.targetClass}` : `Class: ${notice.targetClass}`}
                    </div>
                  )}

                  {/* Content snippet */}
                  <p className="text-xs text-slate-500 line-clamp-3 mt-2 leading-relaxed">
                    {notice.content}
                  </p>
                </div>

                {/* Footer and Admin Action Buttons */}
                <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] font-medium truncate max-w-[140px]">
                    ✍️ {notice.authorName || (isBn ? 'প্রশাসন' : 'Admin')}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {canManage && (
                      <>
                        <button
                          onClick={() => handleTogglePin(notice.id)}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            notice.isPinned ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:bg-slate-100'
                          }`}
                          title={notice.isPinned ? (isBn ? 'আনপিন করুন' : 'Unpin') : (isBn ? 'পিন করুন' : 'Pin to top')}
                        >
                          <Pin size={13} className={notice.isPinned ? 'fill-amber-600' : ''} />
                        </button>

                        <button
                          onClick={() => openCompose(notice)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title={isBn ? 'সম্পাদনা' : 'Edit Notice'}
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          onClick={() => setNoticeToDelete(notice)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title={isBn ? 'মুছে ফেলুন' : 'Delete Notice'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => setSelectedNoticeForModal(notice)}
                      className="text-indigo-600 font-bold hover:underline flex items-center gap-0.5 ml-1 text-xs cursor-pointer"
                    >
                      <span>{isBn ? 'বিস্তারিত' : 'View'}</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* COMPOSE / EDIT FULL NOTICE MODAL (FOR ADMINS)                   */}
      {/* ============================================================== */}
      {isComposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Megaphone size={18} />
                </div>
                <h3 className="text-sm font-bold tracking-tight">
                  {editingNotice 
                    ? (isBn ? 'বিজ্ঞপ্তি সম্পাদনা করুন' : 'Edit Notice')
                    : (isBn ? 'নতুন নোটিশ বা জরুরি আপডেট প্রকাশ করুন' : 'Post New Notice / Urgent Alert')}
                </h3>
              </div>
              <button
                onClick={() => setIsComposeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveNotice} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Title */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isBn ? 'বিজ্ঞপ্তির শিরোনাম *' : 'Notice Headline *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isBn ? 'যেমন: আগামীকাল বুধবার ৩য় ও ৪র্থ শ্রেণির ক্লাস স্থগিত সংক্রান্ত' : 'e.g. Tomorrow: Class 3 & 4 cancelled'}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla font-semibold"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isBn ? 'ক্যাটাগরি / ধরণ *' : 'Category *'}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as NoticeCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="urgent">{isBn ? '🚨 জরুরি আপডেট' : 'Urgent Update'}</option>
                    <option value="cancellation">{isBn ? '🚫 ক্লাস বাতিল / পরিবর্তন' : 'Class Cancellation'}</option>
                    <option value="exam">{isBn ? '📝 পরীক্ষার নোটিশ' : 'Exam Notification'}</option>
                    <option value="holiday">{isBn ? '📅 ছুটির নোটিশ' : 'Holiday Notice'}</option>
                    <option value="event">{isBn ? '✨ অনুষ্ঠান / মাহফিল' : 'Event / Mahfil'}</option>
                    <option value="general">{isBn ? '📢 সাধারণ বিজ্ঞপ্তি' : 'General Notice'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isBn ? 'অগ্রাধিকার (Priority)' : 'Priority'}
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as NoticePriority)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="urgent">{isBn ? 'সর্বোচ্চ জরুরি (Urgent)' : 'Urgent Alert'}</option>
                    <option value="important">{isBn ? 'গুরুত্বপূর্ণ (Important)' : 'Important'}</option>
                    <option value="normal">{isBn ? 'সাধারণ (Normal)' : 'Normal'}</option>
                  </select>
                </div>
              </div>

              {/* Target Audience */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isBn ? 'প্রাপক (Audience)' : 'Target Audience'}
                  </label>
                  <select
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value as NoticeTarget)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="all">{isBn ? 'সকলের জন্য (All)' : 'Everyone'}</option>
                    <option value="students">{isBn ? 'শিক্ষার্থী ও অভিভাবক' : 'Students & Guardians'}</option>
                    <option value="teachers">{isBn ? 'শিক্ষক ও স্টাফ' : 'Faculty & Staff'}</option>
                    <option value="class">{isBn ? 'নির্দিষ্ট শ্রেণি' : 'Specific Class'}</option>
                  </select>
                </div>

                {formTarget === 'class' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isBn ? 'শ্রেণি নির্বাচন' : 'Select Class'}
                    </label>
                    <select
                      value={formTargetClass}
                      onChange={(e) => setFormTargetClass(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                    >
                      <option value="">{isBn ? 'শ্রেণি বাছুন' : 'Select'}</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Content Body */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isBn ? 'বিস্তারিত ঘোষণা / নোটিশের বিবরণ *' : 'Notice Body *'}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={isBn ? 'বিজ্ঞপ্তির পূর্ণাঙ্গ বিবরণ লিখুন...' : 'Write the detailed announcement here...'}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla"
                />
              </div>

              {/* Display Options Checkboxes */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  {isBn ? 'ড্যাশবোর্ড ডিসপ্লে অপশন' : 'Dashboard Display Options'}
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={formShowMarquee}
                      onChange={(e) => setFormShowMarquee(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{isBn ? 'চলমান মারকুই' : 'Marquee Ticker'}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={formShowAlertBanner}
                      onChange={(e) => setFormShowAlertBanner(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500"
                    />
                    <span>{isBn ? 'শীর্ষ অ্যালার্ট ব্যানার' : 'Top Alert Banner'}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>{isBn ? 'উপরে পিন করুন' : 'Pin to Top'}</span>
                  </label>
                </div>
              </div>

              {/* Author Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isBn ? 'ঘোষণাকারীর নাম' : 'Author Name'}
                  </label>
                  <input
                    type="text"
                    value={formAuthorName}
                    onChange={(e) => setFormAuthorName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isBn ? 'পদবী / দায়িত্ব' : 'Designation / Role'}
                  </label>
                  <input
                    type="text"
                    value={formAuthorRole}
                    onChange={(e) => setFormAuthorRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>

                <Button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold shadow-md shadow-indigo-600/20"
                >
                  {editingNotice 
                    ? (isBn ? 'আপডেট সংরক্ষণ করুন' : 'Update Notice')
                    : (isBn ? 'বিজ্ঞপ্তি প্রকাশ করুন' : 'Publish Notice')}
                </Button>
              </div>

              {/* Truthful-save Step 2-বাকি: compose stays open on cloud failure */}
              {composeError && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <div className="flex-1 text-xs font-bold leading-relaxed">{composeError}</div>
                  {pendingCompose && (
                    <button
                      type="button"
                      onClick={handleRetryComposeConfirm}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer"
                    >
                      {isBn ? RETRY_LABEL : 'Retry'}
                    </button>
                  )}
                </div>
              )}

            </form>
          </div>
        </div>
      )}


      {/* Delete Notice Confirmation */}
      <ConfirmDialog
        isOpen={!!noticeToDelete}
        onClose={() => { setNoticeToDelete(null); setPendingDelete(null); }}
        onConfirm={handleConfirmDelete}
        title={isBn ? 'নোটিশ ডিলিট নিশ্চিতকরণ' : 'Confirm Notice Deletion'}
        message={pendingDelete
          ? (NOTICE_DELETE_CLOUD_FAILURE_MESSAGE)
          : (isBn ? 'আপনি কি নিশ্চিত যে এই নোটিশটি মুছে ফেলতে চান?' : 'Delete this notice?')}
        highlightText={noticeToDelete ? noticeToDelete.title : undefined}
        confirmLabel={pendingDelete ? (isBn ? RETRY_LABEL : 'Retry') : (isBn ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete')}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />

    </div>
  );
};
