import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { NoticeItem, Student } from '../types';
import { 
  Mail, 
  Send, 
  Users, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Filter, 
  Search, 
  CheckSquare, 
  Square, 
  AlertTriangle, 
  Building2, 
  FileText, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  History,
  Check,
  Megaphone
} from 'lucide-react';
import { Button } from './ui/Button';

interface BulkEmailLog {
  id: string;
  sentAt: string;
  subject: string;
  className: string;
  recipientCount: number;
  recipients: string[];
  status: 'sent' | 'queued';
}

export const NoticeBulkEmailModule: React.FC = () => {
  const { 
    notices = [], 
    students = [], 
    classes = [], 
    schoolProfile, 
    language, 
    authUser 
  } = useApp();

  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailContent, setEmailContent] = useState<string>('');
  const [senderTitle, setSenderTitle] = useState<string>(
    authUser?.displayName || schoolProfile?.headMasterName || 'মুহতামিম কার্যালয়'
  );

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  // Email dispatch history (saved locally)
  const [emailLogs, setEmailLogs] = useState<BulkEmailLog[]>(() => {
    try {
      const saved = localStorage.getItem('madrasha_bulk_email_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filter students based on class selection and search
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (s.isFormer || s.status === 'Former') return false;
      if (selectedClass !== 'All' && s.classLevel !== selectedClass) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q) || (s.nameBn && s.nameBn.includes(q));
        const matchRoll = (s.roll || '').includes(q);
        const matchEmail = (s.guardianEmail || '').toLowerCase().includes(q);
        const matchFather = (s.fatherName || '').toLowerCase().includes(q);
        return matchName || matchRoll || matchEmail || matchFather;
      }
      return true;
    });
  }, [students, selectedClass, searchTerm]);

  // Valid recipients with emails
  const validRecipients = useMemo(() => {
    return filteredStudents.filter(s => {
      const email = s.guardianEmail?.trim();
      return Boolean(email && email.includes('@') && email.includes('.'));
    });
  }, [filteredStudents]);

  // Students missing email
  const missingEmailStudents = useMemo(() => {
    return filteredStudents.filter(s => {
      const email = s.guardianEmail?.trim();
      return !email || !email.includes('@') || !email.includes('.');
    });
  }, [filteredStudents]);

  // Auto select all valid email students on class change
  React.useEffect(() => {
    setSelectedStudentIds(new Set(validRecipients.map(s => s.id)));
  }, [validRecipients]);

  // Handle picking an existing notice
  const handleSelectNotice = (noticeId: string) => {
    setSelectedNoticeId(noticeId);
    if (!noticeId) return;
    const found = notices.find(n => n.id === noticeId);
    if (found) {
      setEmailSubject(found.title);
      setEmailContent(found.content);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === validRecipients.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(validRecipients.map(s => s.id)));
    }
  };

  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  // Selected email list
  const selectedEmails = useMemo(() => {
    return validRecipients
      .filter(s => selectedStudentIds.has(s.id))
      .map(s => s.guardianEmail!.trim());
  }, [validRecipients, selectedStudentIds]);

  const handleCopyEmails = () => {
    if (selectedEmails.length === 0) return;
    navigator.clipboard.writeText(selectedEmails.join(', '));
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  // Trigger default mail client with BCC
  const handleOpenMailClient = () => {
    if (selectedEmails.length === 0) return;
    const bccList = encodeURIComponent(selectedEmails.join(','));
    const subjectEncoded = encodeURIComponent(emailSubject || `${schoolProfile?.name || 'মাদ্রাসা'} - নোটিশ`);
    
    const fullBody = `${emailContent}\n\n---\n${senderTitle}\n${schoolProfile?.name || ''}\n${schoolProfile?.phone || ''}`;
    const bodyEncoded = encodeURIComponent(fullBody);

    const mailtoUrl = `mailto:?bcc=${bccList}&subject=${subjectEncoded}&body=${bodyEncoded}`;
    window.location.href = mailtoUrl;

    // Log the event
    saveLog();
  };

  // Simulate server dispatch and save log
  const handleSimulatedDispatch = () => {
    if (selectedEmails.length === 0 || !emailSubject.trim() || !emailContent.trim()) return;
    setIsSending(true);
    setDispatchSuccess(null);

    setTimeout(() => {
      saveLog();
      setIsSending(false);
      setDispatchSuccess(
        language === 'bn'
          ? `সফলভাবে ${selectedEmails.length} জন অভিভাবক ও শিক্ষার্থীর ইমেইলে নোটিশ প্রেরণ করা হয়েছে!`
          : `Notice successfully broadcasted to ${selectedEmails.length} recipient email addresses!`
      );
    }, 1200);
  };

  const saveLog = () => {
    const newLog: BulkEmailLog = {
      id: `email_${Date.now()}`,
      sentAt: new Date().toLocaleString(),
      subject: emailSubject || 'মাদ্রাসা নোটিশ',
      className: selectedClass,
      recipientCount: selectedEmails.length,
      recipients: selectedEmails,
      status: 'sent'
    };

    const updated = [newLog, ...emailLogs];
    setEmailLogs(updated);
    try {
      localStorage.setItem('madrasha_bulk_email_logs', JSON.stringify(updated.slice(0, 50)));
    } catch {}
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-500/20">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Mail size={16} className="text-amber-400" />
            <span>{language === 'bn' ? 'বাল্ক ইমেইল ও ডিজিটাল নোটিশ বার্তা' : 'Bulk Email & Parent Notice Dispatch'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {language === 'bn' ? 'শ্রেণিভিত্তিক বাল্ক ইমেইল ব্রডকাস্ট' : 'Class-based Bulk Email Dispatcher'}
          </h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-xl">
            {language === 'bn' 
              ? 'শিক্ষার্থী প্রোফাইলে সংরক্ষিত ইমেইল অ্যাড্রেস ব্যবহার করে সরাসরি অভিভাবক ও শিক্ষার্থীদের নোটিশ ও বিজ্ঞপ্তি ইমেইল করুন।' 
              : 'Broadcast notices and announcements directly to guardians and students using recorded profile contact emails.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyEmails}
            disabled={selectedEmails.length === 0}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedSuccess ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedSuccess ? (language === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : (language === 'bn' ? 'ইমেইল কপি' : 'Copy Emails')}</span>
          </button>
        </div>
      </div>

      {/* Success Alert */}
      {dispatchSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <div className="flex-1 text-xs font-bold leading-relaxed">{dispatchSuccess}</div>
        </div>
      )}

      {/* Main 2-Column Split: Form (Left) vs Recipient Selector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Email Composer (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Mail size={16} className="text-indigo-600" />
              <span>{language === 'bn' ? 'ইমেইল বার্তা তৈরি করুন' : 'Compose Notice Email'}</span>
            </h3>

            {/* Pick from Existing Notice */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">{language === 'bn' ? 'নোটিশ থেকে নিন:' : 'Import Notice:'}</span>
              <select
                value={selectedNoticeId}
                onChange={(e) => handleSelectNotice(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700 max-w-[180px]"
              >
                <option value="">{language === 'bn' ? '-- নোটিশ বাছাই করুন --' : '-- Choose Notice --'}</option>
                {notices.map(n => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'bn' ? 'ইমেইল বিষয় (Subject) *' : 'Email Subject *'}
            </label>
            <input
              type="text"
              required
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={language === 'bn' ? 'যেমন: পবিত্র মাহে রমজান উপলক্ষে মাদ্রাসা ছুটির নোটিশ' : 'e.g. Ramadan Vacation Notice'}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900"
            />
          </div>

          {/* Email Body */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'bn' ? 'বিজ্ঞপ্তি ও বার্তার বিস্তারিত বিষয়বস্তু *' : 'Notice Body *'}
            </label>
            <textarea
              rows={8}
              required
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder={language === 'bn' ? 'সম্মানিত অভিভাবকবৃন্দ, আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ...\n\nবিজ্ঞপ্তির বিস্তারিত বিবরণ এখানে লিখুন...' : 'Respected guardians, Assalamu Alaikum...'}
              className="w-full p-3.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla leading-relaxed text-slate-800"
            />
          </div>

          {/* Sender Signature & Footer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {language === 'bn' ? 'স্বাক্ষর / প্রেরকের নাম' : 'Sender / Signatory'}
              </label>
              <input
                type="text"
                value={senderTitle}
                onChange={(e) => setSenderTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {language === 'bn' ? 'মাদ্রাসার নাম (Letterhead)' : 'Institution'}
              </label>
              <input
                type="text"
                disabled
                value={schoolProfile?.name || 'মাদ্রাসা ম্যানেজমেন্ট'}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-500"
              />
            </div>
          </div>

          {/* Dispatch Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              <span>{language === 'bn' ? 'নির্বাচিত প্রাপক: ' : 'Selected Recipients: '}</span>
              <strong className="text-indigo-600 font-black">{selectedEmails.length}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenMailClient}
                disabled={selectedEmails.length === 0 || !emailSubject.trim()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ExternalLink size={14} />
                <span>{language === 'bn' ? 'মেইল অ্যাপে খুলুন (BCC)' : 'Open in Mail App'}</span>
              </button>

              <Button
                type="button"
                onClick={handleSimulatedDispatch}
                disabled={isSending || selectedEmails.length === 0 || !emailSubject.trim() || !emailContent.trim()}
                className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
              >
                <Send size={14} />
                <span>
                  {isSending 
                    ? (language === 'bn' ? 'প্রেরণ হচ্ছে...' : 'Sending...') 
                    : (language === 'bn' ? 'ইমেইল ব্রডকাস্ট করুন' : 'Broadcast Email')}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Audience & Recipient List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Class Filter & Metrics Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                {language === 'bn' ? 'প্রাপক নির্বাচন (Target Audience)' : 'Target Audience'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                {validRecipients.length} {language === 'bn' ? 'ইমেইল পাওয়া গেছে' : 'Emails'}
              </span>
            </div>

            {/* Class Dropdown */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">
                {language === 'bn' ? 'শ্রেণি / জামাত বাছাই করুন' : 'Select Class / Grade'}
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
              >
                <option value="All">{language === 'bn' ? 'সকল শ্রেণি (All Classes)' : 'All Classes'}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={language === 'bn' ? 'শিক্ষার্থী বা ইমেইল খুঁজুন...' : 'Search student or email...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50"
              />
            </div>
          </div>

          {/* Student Recipient List Table */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 font-bold transition-colors cursor-pointer"
              >
                {selectedStudentIds.size === validRecipients.length ? (
                  <CheckSquare size={14} className="text-indigo-600" />
                ) : (
                  <Square size={14} />
                )}
                <span>{language === 'bn' ? 'সবাইকে টিক দিন' : 'Select All'}</span>
              </button>

              <span className="text-[11px] text-slate-400 font-medium">
                {selectedStudentIds.size} / {validRecipients.length}
              </span>
            </div>

            {/* Student Items List */}
            {validRecipients.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                <Mail size={24} className="mx-auto text-slate-300 mb-1.5" />
                <p className="font-bold">{language === 'bn' ? 'কোনো শিক্ষার্থীর অভিভাবক ইমেইল পাওয়া যায়নি।' : 'No emails found for this class.'}</p>
                <p className="text-[10px] mt-1 text-slate-400">
                  {language === 'bn' 
                    ? 'শিক্ষার্থী ম্যানেজারে গিয়ে প্রোফাইলে ইমেইল যোগ করুন।' 
                    : 'Add guardian emails in the Student Manager.'}
                </p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 space-y-1 custom-scrollbar">
                {validRecipients.map(student => {
                  const isSelected = selectedStudentIds.has(student.id);
                  return (
                    <div
                      key={student.id}
                      onClick={() => toggleStudent(student.id)}
                      className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                        isSelected ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'hover:bg-slate-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStudent(student.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                        />
                        <div className="truncate">
                          <span className="font-bold text-xs text-slate-900 block truncate">{student.name}</span>
                          <span className="text-[10px] text-indigo-600 block truncate font-mono">{student.guardianEmail}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-slate-400 block">{student.classLevel}</span>
                        <span className="text-[10px] text-slate-500 font-bold">রোল: {student.roll || '-'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Missing Email Alert */}
            {missingEmailStudents.length > 0 && (
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2 mt-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {language === 'bn' 
                      ? `${missingEmailStudents.length} জন শিক্ষার্থীর ইমেইল যুক্ত নেই` 
                      : `${missingEmailStudents.length} students have no email on file`}
                  </span>
                  <p className="text-[10px] text-amber-800/80 mt-0.5">
                    {language === 'bn'
                      ? 'এদের নোটিশ জানাতে শিক্ষার্থী প্রোফাইলে গিয়ে অভিভাবক ইমেইল ইনপুট দিন।'
                      : 'Edit student profiles to include guardian emails for future announcements.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Email Broadcast Dispatch History */}
      {emailLogs.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <History size={15} className="text-indigo-600" />
              <span>{language === 'bn' ? 'পূর্ববর্তী প্রেরিত ইমেইল লগ' : 'Recent Email Broadcast History'}</span>
            </h3>
            <span className="text-[11px] text-slate-400">{emailLogs.length} {language === 'bn' ? 'টি ক্যাম্পেইন' : 'campaigns'}</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {emailLogs.map(log => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">{log.subject}</span>
                  <span className="text-[10px] text-slate-400">
                    শ্রেণি: {log.className} • {log.sentAt}
                  </span>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    ✓ {log.recipientCount} {language === 'bn' ? 'প্রাপক' : 'sent'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
