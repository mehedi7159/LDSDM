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
  Search, 
  Trash2, 
  Edit2, 
  Printer, 
  Sparkles, 
  CheckCircle2, 
  BookOpen, 
  ShieldCheck, 
  X, 
  Filter,
  Eye,
  Mail
} from 'lucide-react';
import { Button } from './ui/Button';
import { NoticeBulkEmailModule } from './NoticeBulkEmailModule';

export const NoticeBoardManager: React.FC = () => {
  const { notices = [], addNotice, updateNotice, deleteNotice, isAdmin, isSuperAdmin, authUser, language, classes = [], schoolProfile } = useApp();
  const isOwnerAdmin = isSuperAdmin || (authUser?.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
  const canManage = isOwnerAdmin || isAdmin;

  const [activeBoardTab, setActiveBoardTab] = useState<'notices' | 'bulk_email'>('notices');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
  const [noticeToPrint, setNoticeToPrint] = useState<NoticeItem | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('general');
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [target, setTarget] = useState<NoticeTarget>('all');
  const [targetClass, setTargetClass] = useState<string>('');
  const [isPinned, setIsPinned] = useState(false);
  const [authorName, setAuthorName] = useState(authUser?.displayName || 'মুহতামিম কার্যালয়');

  const openCompose = (noticeToEdit?: NoticeItem) => {
    if (noticeToEdit) {
      setEditingNotice(noticeToEdit);
      setTitle(noticeToEdit.title);
      setContent(noticeToEdit.content);
      setCategory(noticeToEdit.category);
      setPriority(noticeToEdit.priority);
      setTarget(noticeToEdit.target);
      setTargetClass(noticeToEdit.targetClass || '');
      setIsPinned(Boolean(noticeToEdit.isPinned));
      setAuthorName(noticeToEdit.authorName || 'মুহতামিম কার্যালয়');
    } else {
      setEditingNotice(null);
      setTitle('');
      setContent('');
      setCategory('general');
      setPriority('normal');
      setTarget('all');
      setTargetClass('');
      setIsPinned(false);
      setAuthorName(authUser?.displayName || 'মুহতামিম কার্যালয়');
    }
    setIsComposeModalOpen(true);
  };

  const handleSaveNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    if (editingNotice) {
      updateNotice({
        ...editingNotice,
        title: title.trim(),
        content: content.trim(),
        category,
        priority,
        target,
        targetClass: target === 'class' ? targetClass : undefined,
        isPinned,
        authorName: authorName.trim() || 'প্রশাসন',
      });
    } else {
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
    }

    setIsComposeModalOpen(false);
    setEditingNotice(null);
  };

  // Filtered notices
  const filteredNotices = useMemo(() => {
    let list = [...notices];

    // Priority sorting: Pinned first, then newest date
    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime();
    });

    if (selectedCategory !== 'all') {
      list = list.filter(n => n.category === selectedCategory);
    }

    if (selectedPriority !== 'all') {
      list = list.filter(n => n.priority === selectedPriority);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.content.toLowerCase().includes(q) ||
        (n.authorName && n.authorName.toLowerCase().includes(q)) ||
        (n.targetClass && n.targetClass.toLowerCase().includes(q))
      );
    }

    return list;
  }, [notices, selectedCategory, selectedPriority, searchQuery]);

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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-amber-400/20 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-amber-200 text-xs font-bold uppercase tracking-wider mb-1">
            <Megaphone size={16} />
            <span>{language === 'bn' ? 'ডিজিটাল নোটিশ ও ঘোষণা বোর্ড' : 'Institutional Notice Board & Daily Diary'}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {language === 'bn' ? 'নোটিশ বোর্ড ও দৈনিক ডায়েরি ব্যবস্থাপনা' : 'Notice Board & Daily Activities'}
          </h1>
          <p className="text-xs text-amber-100/90 mt-1 max-w-xl">
            {language === 'bn' 
              ? 'মাদ্রাসার সমস্ত জরুরি নোটিশ, ছুটির বিজ্ঞপ্তি, পরীক্ষা বার্তা ও দৈনিক ক্লাসের বাড়ির কাজ পোস্ট ও পরিচালনা করুন।' 
              : 'Post and manage announcements, holidays, exam notifications and daily homework activities.'}
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => openCompose()}
            className="px-5 py-2.5 bg-white text-indigo-950 hover:bg-slate-100 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>{language === 'bn' ? 'নতুন নোটিশ বা ডায়েরি লিখুন' : 'Post New Notice'}</span>
          </Button>
        )}
      </div>

      {/* Main Tab Navigation for Notice Board */}
      <div className="flex border-b border-gray-200 bg-white rounded-2xl p-1.5 shadow-xs gap-1.5 print:hidden">
        <button
          type="button"
          onClick={() => setActiveBoardTab('notices')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-5 font-bold text-xs rounded-xl transition-all cursor-pointer ${
            activeBoardTab === 'notices'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Megaphone size={16} />
          <span>{language === 'bn' ? 'সকল নোটিশ ও দৈনিক ডায়েরি' : 'All Notices & Diary'}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeBoardTab === 'notices' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {notices.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveBoardTab('bulk_email')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-5 font-bold text-xs rounded-xl transition-all cursor-pointer ${
            activeBoardTab === 'bulk_email'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Mail size={16} />
          <span>{language === 'bn' ? 'বাল্ক ইমেইল নোটিশ ব্রডকাস্ট' : 'Bulk Email Dispatch'}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeBoardTab === 'bulk_email' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
          }`}>
            New
          </span>
        </button>
      </div>

      {activeBoardTab === 'bulk_email' ? (
        <NoticeBulkEmailModule />
      ) : (
        <>
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex-1 min-w-[220px] relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'নোটিশের শিরোনাম বা বিষয়বস্তু খুঁজুন...' : 'Search notice by title or content...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
          >
            <option value="all">{language === 'bn' ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
            <option value="general">{language === 'bn' ? 'সাধারণ নোটিশ' : 'General'}</option>
            <option value="diary">{language === 'bn' ? 'দৈনিক ডায়েরি' : 'Daily Diary'}</option>
            <option value="urgent">{language === 'bn' ? 'জরুরি বিজ্ঞপ্তি' : 'Urgent'}</option>
            <option value="exam">{language === 'bn' ? 'পরীক্ষা সংক্রান্ত' : 'Exam'}</option>
            <option value="holiday">{language === 'bn' ? 'ছুটির নোটিশ' : 'Holiday'}</option>
            <option value="event">{language === 'bn' ? 'অনুষ্ঠান / মাহফিল' : 'Event'}</option>
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
          >
            <option value="all">{language === 'bn' ? 'সকল অগ্রাধিকার' : 'All Priorities'}</option>
            <option value="urgent">{language === 'bn' ? 'জরুরি (Urgent)' : 'Urgent'}</option>
            <option value="important">{language === 'bn' ? 'গুরুত্বপূর্ণ' : 'Important'}</option>
            <option value="normal">{language === 'bn' ? 'সাধারণ' : 'Normal'}</option>
          </select>
        </div>
      </div>

      {/* Notices Grid */}
      {filteredNotices.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-400">
          <BookOpen size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="font-bold">{language === 'bn' ? 'কোনো নোটিশ পাওয়া যায়নি' : 'No notices found'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
          {filteredNotices.map((notice) => {
            const badge = getCategoryBadge(notice.category);
            const isUrgent = notice.priority === 'urgent';

            return (
              <div 
                key={notice.id} 
                className={`bg-white rounded-3xl border p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all ${
                  isUrgent ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${badge.style}`}>
                        {badge.label}
                      </span>
                      {notice.isPinned && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold">
                          <Pin size={11} className="fill-amber-600" />
                          <span>{language === 'bn' ? 'পিন করা' : 'Pinned'}</span>
                        </span>
                      )}
                      {notice.targetClass && (
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                          {notice.targetClass}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {notice.date}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-black text-slate-900 leading-snug">
                    {notice.title}
                  </h3>

                  {/* Body Content */}
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-line font-bangla">
                    {notice.content}
                  </p>
                </div>

                {/* Card Footer & Action Buttons */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="truncate max-w-[130px] font-medium">✍️ {notice.authorName || 'প্রশাসন'}</span>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setNoticeToPrint(notice)}
                      title={language === 'bn' ? 'প্রিন্ট ফরম্যাট দেখুন' : 'Print View'}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                    >
                      <Printer size={15} />
                    </button>

                    {canManage && (
                      <>
                        <button
                          onClick={() => openCompose(notice)}
                          title="Edit"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(language === 'bn' ? 'আপনি কি নিশ্চিত যে এই নোটিশটি মুছে ফেলতে চান?' : 'Are you sure you want to delete this notice?')) {
                              deleteNotice(notice.id);
                            }
                          }}
                          title="Delete"
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Print Single Notice View Modal */}
      {noticeToPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <span className="text-xs font-bold">{language === 'bn' ? 'প্রিন্ট প্রিভিউ' : 'Official Print View'}</span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer size={14} />
                  <span>{language === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
                </Button>
                <button
                  onClick={() => setNoticeToPrint(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Letterhead & Notice Content */}
            <div className="p-8 sm:p-12 space-y-6">
              <div className="text-center pb-6 border-b-2 border-indigo-900">
                <h1 className="text-xl font-black text-slate-900 uppercase">{schoolProfile?.name || 'মাদ্রাসা ম্যানেজমেন্ট'}</h1>
                <p className="text-xs text-slate-500">{schoolProfile?.address || ''}</p>
                <div className="inline-block px-3 py-1 mt-3 rounded-full bg-slate-900 text-white text-xs font-black uppercase tracking-wider">
                  {language === 'bn' ? 'প্রাতিষ্ঠানিক বিজ্ঞপ্তি' : 'OFFICIAL NOTICE'}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-100 pb-2">
                <span>স্মারক নং: {noticeToPrint.id.toUpperCase()}</span>
                <span>তারিখ: {noticeToPrint.date}</span>
              </div>

              <div>
                <h2 className="text-lg font-black text-slate-900 leading-snug">
                  {noticeToPrint.title}
                </h2>
                {noticeToPrint.targetClass && (
                  <p className="text-xs text-indigo-700 font-bold mt-1">
                    শ্রেণি: {noticeToPrint.targetClass}
                  </p>
                )}
              </div>

              <div className="text-sm leading-relaxed text-slate-800 text-justify whitespace-pre-line font-bangla pt-2">
                {noticeToPrint.content}
              </div>

              <div className="pt-12 flex justify-end">
                <div className="text-center">
                  <div className="w-32 border-b border-slate-700 pb-1">
                    {schoolProfile.signatureUrl ? (
                      <img src={schoolProfile.signatureUrl} alt="Signature" className="h-6 mx-auto object-contain" />
                    ) : (
                      <span className="font-bold text-xs text-slate-800">{noticeToPrint.authorName || 'মুহতামিম'}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">স্বাক্ষর ও প্রাতিষ্ঠানিক সিল</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose / Edit Modal */}
      {isComposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-amber-600 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone size={18} />
                <h3 className="text-sm font-bold tracking-tight">
                  {editingNotice 
                    ? (language === 'bn' ? 'বিজ্ঞপ্তি সম্পাদনা করুন' : 'Edit Notice')
                    : (language === 'bn' ? 'নতুন নোটিশ বা দৈনিক ডায়েরি তৈরি' : 'Post New Notice')}
                </h3>
              </div>
              <button
                onClick={() => setIsComposeModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveNotice} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'bn' ? 'শিরোনাম *' : 'Title *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'bn' ? 'বিজ্ঞপ্তির শিরোনাম লিখুন' : 'Notice title'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

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
                    <option value="general">{language === 'bn' ? 'সাধারণ নোটিশ' : 'General'}</option>
                    <option value="diary">{language === 'bn' ? 'দৈনিক ডায়েরি / সবক' : 'Daily Diary'}</option>
                    <option value="urgent">{language === 'bn' ? 'জরুরি বিজ্ঞপ্তি' : 'Urgent'}</option>
                    <option value="exam">{language === 'bn' ? 'পরীক্ষা সংক্রান্ত' : 'Exam'}</option>
                    <option value="holiday">{language === 'bn' ? 'ছুটির নোটিশ' : 'Holiday'}</option>
                    <option value="event">{language === 'bn' ? 'অনুষ্ঠান / মাহফিল' : 'Event'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'অগ্রাধিকার' : 'Priority'}
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
                    <option value="students">{language === 'bn' ? 'শিক্ষার্থী ও অভিভাবক' : 'Students'}</option>
                    <option value="teachers">{language === 'bn' ? 'উস্তাদবৃন্দ (Teachers)' : 'Teachers'}</option>
                    <option value="class">{language === 'bn' ? 'নির্দিষ্ট শ্রেণি' : 'Specific Class'}</option>
                  </select>
                </div>

                {target === 'class' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {language === 'bn' ? 'শ্রেণি বাছুন' : 'Select Class'}
                    </label>
                    <select
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                    >
                      <option value="">{language === 'bn' ? 'শ্রেণি নির্বাচন করুন' : 'Select'}</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'bn' ? 'বিস্তারিত নোটিশ বা সবক বিবরণী *' : 'Content *'}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={language === 'bn' ? 'বিজ্ঞপ্তির বিস্তারিত বা ডায়েরির বাড়ির কাজ এখানে লিখুন...' : 'Write notice details here...'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex-1 mr-4">
                  <input
                    type="text"
                    placeholder="ঘোষণাকারীর নাম (যেমন: মুহতামিম)"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 font-medium"
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
                  {editingNotice 
                    ? (language === 'bn' ? 'আপডেট করুন' : 'Update Notice')
                    : (language === 'bn' ? 'বিজ্ঞপ্তি প্রকাশ করুন' : 'Publish Notice')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
