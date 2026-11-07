import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Student } from '../../types';
import { formatNumber, formatSafeDate } from '../../services/utils';
import {
  getAdmissionApplications,
  saveAdmissionApplications,
  subscribeAdmissionApplications,
  toOfficeApplication,
  fromOfficeApplication,
  updateAdmissionApplicationStatus,
  OfficeAdmissionApplication
} from '../../services/admissionApplicationsService';
import { Button } from '../ui/Button';
import { UnconfirmedBadge } from '../ui/UnconfirmedBadge';
import { useTheme } from '../../context/ThemeContext';
import { RETRY_LABEL, STUDENTS_CLOUD_FAILURE_MESSAGE } from '../../services/cloudConfirm';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Phone,
  Printer,
  Calendar,
  User,
  GraduationCap,
  ShieldAlert,
  Sparkles,
  ArrowRight
} from 'lucide-react';

/**
 * The office shape is now defined by the canonical admission service —
 * this screen and the Online Admissions tracker share ONE store
 * (services/admissionApplicationsService.ts). The type is re-exported
 * under its historical name for existing importers (StudentManager).
 */
export type AdmissionApplication = OfficeAdmissionApplication;

export const AdmissionApplicationManager: React.FC<{
  onEnrollStudent?: (app: AdmissionApplication) => void;
}> = ({ onEnrollStudent }) => {
  const { classes, addStudent, confirmStudentsCloudSync, isRecordUnconfirmed, language } = useApp();
  const { showToast } = useTheme();
  const isBn = language === 'bn';

  // 7 Nov 2026 Job 5 (instant approve+enroll): a failed background
  // confirm keeps the saved student list + record id here, so Retry
  // re-confirms exactly what was enrolled — never a second addStudent
  // call (which would mint a new random autoStudentId and enrol the
  // same applicant twice).
  type FailedEnroll = { students: Student[]; studentId: string; studentNo: string; applicantName: string; message: string };
  const [enrollFailures, setEnrollFailures] = useState<Record<string, FailedEnroll>>({});
  // Failed enrolments whose student is still unconfirmed (the banner
  // hides itself once the payload lands here or via Diagnostics).
  const failedEnrolls = Object.keys(enrollFailures).flatMap(appId => {
    const f = enrollFailures[appId];
    const app = applications.find(a => a.id === appId);
    return f && app && isRecordUnconfirmed('students', f.studentId) ? [{ app, f }] : [];
  });
  // In-flight guard per application id (ref = authoritative: two taps
  // in the same tick must both see the first one; state mirrors it
  // for the button label/disabled rendering).
  const enrollingRef = useRef<Set<string>>(new Set());
  const [enrollingAppIds, setEnrollingAppIds] = useState<ReadonlySet<string>>(new Set());
  const [isRetryingId, setIsRetryingId] = useState<string | null>(null);

  // Stored applications — read from the canonical unified store
  const [applications, setApplications] = useState<AdmissionApplication[]>(() =>
    getAdmissionApplications().map(toOfficeApplication)
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AdmissionApplication | null>(null);

  // Form State for new application intake
  const [formData, setFormData] = useState({
    applicantName: '',
    applicantNameBn: '',
    gender: 'male' as 'male' | 'female',
    dateOfBirth: '',
    desiredClass: classes[0]?.name || '',
    fatherName: '',
    fatherNameBn: '',
    motherName: '',
    guardianPhone: '',
    guardianEmail: '',
    previousSchool: '',
    address: '',
    notes: ''
  });

  // Persist every change to the canonical store, and pick up changes made
  // from the Online Admissions tracker (same underlying records).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveAdmissionApplications(applications.map(fromOfficeApplication));
  }, [applications]);

  useEffect(() => {
    return subscribeAdmissionApplications(() => {
      setApplications(getAdmissionApplications().map(toOfficeApplication));
    });
  }, []);

  const handleCreateApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.applicantName.trim() || !formData.guardianPhone.trim()) {
      showToast({
        type: 'error',
        title: isBn ? 'তথ্য অসম্পূর্ণ' : 'Missing Information',
        message: isBn ? 'অনুগ্রহ করে আবেদনকারীর নাম ও অভিভাবকের ফোন নম্বর প্রদান করুন।' : 'Please enter applicant name and phone number.'
      });
      return;
    }

    const currentYear = new Date().getFullYear();
    const newApp: AdmissionApplication = {
      id: `app-${Date.now()}`,
      applicationNo: `ADM-${currentYear}-${String(applications.length + 1).padStart(3, '0')}`,
      applicantName: formData.applicantName.trim(),
      applicantNameBn: formData.applicantNameBn.trim() || formData.applicantName.trim(),
      gender: formData.gender,
      dateOfBirth: formData.dateOfBirth || new Date().toISOString().split('T')[0],
      desiredClass: formData.desiredClass || classes[0]?.name || '',
      fatherName: formData.fatherName.trim(),
      fatherNameBn: formData.fatherNameBn.trim() || formData.fatherName.trim(),
      motherName: formData.motherName.trim(),
      guardianPhone: formData.guardianPhone.trim(),
      guardianEmail: formData.guardianEmail.trim(),
      previousSchool: formData.previousSchool.trim(),
      address: formData.address.trim(),
      appliedDate: new Date().toISOString().split('T')[0],
      status: 'PENDING',
      notes: formData.notes.trim()
    };

    setApplications(prev => [newApp, ...prev]);
    setIsAddModalOpen(false);
    setFormData({
      applicantName: '',
      applicantNameBn: '',
      gender: 'male',
      dateOfBirth: '',
      desiredClass: classes[0]?.name || '',
      fatherName: '',
      fatherNameBn: '',
      motherName: '',
      guardianPhone: '',
      guardianEmail: '',
      previousSchool: '',
      address: '',
      notes: ''
    });
  };

  // Plain-language confirm failure: a timeout (slow connection) says so
  // explicitly instead of the generic cloud message — same helper as
  // the student form (Job 0), because confirmStudentsCloudSync already
  // passes { includeRawError: true } and the raw text is in rawMessage.
  const confirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the save did not finish. Try again on a better connection.')
      : (result.message || STUDENTS_CLOUD_FAILURE_MESSAGE));

  // The cloud confirm has landed — ONLY now does the application become
  // APPROVED (this screen + the canonical store, so the Online
  // Admissions tracker shows it as admitted too) and the user is taken
  // to the student list. Shared by the background confirm + Retry.
  const markEnrolledApproved = (app: AdmissionApplication, studentNo: string) => {
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'APPROVED' } : a));
    updateAdmissionApplicationStatus(app.id, 'admitted');
    if (onEnrollStudent) {
      onEnrollStudent(app);
    }
    showToast({
      type: 'success',
      message: isBn
        ? `অভিনন্দন! "${app.applicantNameBn || app.applicantName}" সফলভাবে শিক্ষার্থী হিসেবে ভর্তি হয়েছেন (আইডি: ${studentNo})।`
        : `Success! "${app.applicantName}" has been successfully enrolled as a student (ID: ${studentNo}).`
    });
  };

  // 7 Nov 2026 Job 5 (instant approve+enroll, Job 0 template): the old
  // handler block-awaited the cloud confirm AFTER already marking the
  // application APPROVED (and switching to the student list) — so a
  // failed confirm left the row stuck as "ভর্তি সম্পন্ন" with no retry,
  // and a double-tap re-ran addStudent with a new random autoStudentId
  // (duplicate enrolment). Now the local enrolment applies AT ONCE and
  // the confirm runs in the BACKGROUND via the same
  // confirmStudentsCloudSync (90s timeout, raw error text). APPROVED is
  // set only when the confirm lands. On failure the payload stays
  // queued, the row keeps its amber 'cloud-এ যায়নি' badge + Retry, and
  // the application stays PENDING. Never a false 'saved to cloud'.
  const handleApproveAndEnroll = (app: AdmissionApplication) => {
    // Double-enrol guard: one approval enrols one student, once. A
    // second tap while the background confirm is still running — or a
    // tap on a row whose enrolment already failed — must never call
    // addStudent again. A failed enrolment is recovered only via Retry,
    // which re-confirms the same saved list.
    if (enrollingRef.current.has(app.id) || enrollFailures[app.id]) return;
    try {
      // 1. Add as active enrolled student (local apply, at once)
      const currentYear = new Date().getFullYear();
      const autoStudentId = `${currentYear}${Math.floor(100 + Math.random() * 900)}`;

      const added = addStudent({
        name: app.applicantName,
        nameBn: app.applicantNameBn || app.applicantName,
        gender: app.gender,
        dateOfBirth: app.dateOfBirth,
        classLevel: app.desiredClass,
        studentId: autoStudentId,
        roll: '১',
        rollNumber: '১',
        fatherName: app.fatherName,
        fatherNameBn: app.fatherNameBn || app.fatherName,
        motherName: app.motherName,
        guardianName: app.fatherNameBn || app.fatherName || 'অভিভাবক',
        guardianPhone: app.guardianPhone,
        guardianEmail: app.guardianEmail || '',
        address: app.address,
        admissionDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        isFormer: false
      });

      enrollingRef.current.add(app.id);
      setEnrollingAppIds(prev => new Set(prev).add(app.id));

      // Honest local feedback at once: the student is on this device
      // now; the cloud confirm is running in the background.
      showToast({
        type: 'success',
        message: isBn
          ? `"${app.applicantNameBn || app.applicantName}" এই ডিভাইসে ভর্তি হয়েছে — cloud-এ যাচ্ছে…`
          : `"${app.applicantName}" enrolled on this device — syncing to cloud…`
      });

      // 2. Background confirm — fire and forget from the UI's point of
      // view. On failure confirmStudentsCloudSync queues the payload
      // (via confirmUpsertFailure), so the amber badge + Retry appear
      // and the Diagnostics queue can retry it.
      void confirmStudentsCloudSync(added.students).then((result) => {
        enrollingRef.current.delete(app.id);
        setEnrollingAppIds(prev => { const next = new Set(prev); next.delete(app.id); return next; });
        if (!result.success) {
          setEnrollFailures(prev => ({
            ...prev,
            [app.id]: {
              students: added.students,
              studentId: added.student.id,
              studentNo: autoStudentId,
              applicantName: app.applicantNameBn || app.applicantName,
              message: confirmErrorMessage(result)
            }
          }));
          showToast({ type: 'error', message: confirmErrorMessage(result) });
          return;
        }
        markEnrolledApproved(app, autoStudentId);
      }).catch((err) => {
        console.error('Background admission enrol cloud confirm failed:', err);
        enrollingRef.current.delete(app.id);
        setEnrollingAppIds(prev => { const next = new Set(prev); next.delete(app.id); return next; });
        setEnrollFailures(prev => ({
          ...prev,
          [app.id]: {
            students: added.students,
            studentId: added.student.id,
            studentNo: autoStudentId,
            applicantName: app.applicantNameBn || app.applicantName,
            message: STUDENTS_CLOUD_FAILURE_MESSAGE
          }
        }));
        showToast({ type: 'error', message: STUDENTS_CLOUD_FAILURE_MESSAGE });
      });
    } catch (err) {
      console.error('Approve & enrol failed:', err);
      showToast({
        type: 'error',
        message: isBn ? 'ভর্তি অনুমোদন করা যায়নি — আবার চেষ্টা করুন।' : 'Could not approve & enrol — please try again.'
      });
    }
  };

  // Retry re-confirms the already-enrolled student (no re-enrol, no new
  // student id). Only the explicit Retry awaits the confirm. On success
  // the application becomes APPROVED exactly as a first-time landing.
  const handleRetryEnroll = async (app: AdmissionApplication) => {
    const failure = enrollFailures[app.id];
    if (!failure || isRetryingId) return;
    setIsRetryingId(app.id);
    try {
      const result = await confirmStudentsCloudSync(failure.students);
      if (!result.success) {
        setEnrollFailures(prev => ({ ...prev, [app.id]: { ...failure, message: confirmErrorMessage(result) } }));
        showToast({ type: 'error', message: confirmErrorMessage(result) });
        return;
      }
      setEnrollFailures(prev => { const next = { ...prev }; delete next[app.id]; return next; });
      markEnrolledApproved(app, failure.studentNo);
    } catch (err) {
      console.error('Admission enrol retry failed:', err);
      showToast({ type: 'error', message: STUDENTS_CLOUD_FAILURE_MESSAGE });
    } finally {
      setIsRetryingId(null);
    }
  };

  const handleReject = (appId: string) => {
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'REJECTED' } : a));
  };

  // Filtered applications
  const filteredApps = applications.filter(app => {
    const matchesStatus = filterStatus === 'ALL' || app.status === filterStatus;
    const matchesClass = filterClass === 'All' || app.desiredClass === filterClass;
    const q = searchTerm.toLowerCase().trim();
    if (!q) return matchesStatus && matchesClass;

    const matchesSearch = 
      app.applicantName.toLowerCase().includes(q) ||
      (app.applicantNameBn && app.applicantNameBn.includes(q)) ||
      app.applicationNo.toLowerCase().includes(q) ||
      app.guardianPhone.includes(q) ||
      app.fatherName.toLowerCase().includes(q);

    return matchesStatus && matchesClass && matchesSearch;
  });

  const pendingCount = applications.filter(a => a.status === 'PENDING').length;
  const approvedCount = applications.filter(a => a.status === 'APPROVED').length;
  const rejectedCount = applications.filter(a => a.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      
      {/* KPI Stats Strip for Admission */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{isBn ? 'মোট ভর্তি আবেদন' : 'Total Applications'}</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{formatNumber(applications.length, language)}</p>
          <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">{isBn ? 'চলতি শিক্ষাবর্ষ' : 'Current Session'}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/30">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">{isBn ? 'অপেক্ষমাণ আবেদন' : 'Pending'}</p>
          <p className="text-3xl font-black text-amber-900 dark:text-amber-200 mt-1">{formatNumber(pendingCount, language)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">{isBn ? 'অনুমোদিত ও ভর্তি সম্পন্ন' : 'Enrolled / Approved'}</p>
          <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1">{formatNumber(approvedCount, language)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/30">
          <p className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">{isBn ? 'বাতিলকৃত' : 'Rejected'}</p>
          <p className="text-2xl font-black text-rose-900 dark:text-rose-200 mt-1">{formatNumber(rejectedCount, language)}</p>
        </div>
      </div>

      {/* Action Header & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={17} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isBn ? 'আবেদন নং, প্রার্থীর নাম বা মোবাইল দিয়ে খুঁজুন...' : 'Search by application no, name, phone...'}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="w-40 shrink-0">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
            >
              <option value="All">{isBn ? 'সকল শ্রেণি' : 'All Classes'}</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-36 shrink-0">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">{isBn ? 'সকল অবস্থা' : 'All Status'}</option>
              <option value="PENDING">{isBn ? 'অপেক্ষমাণ' : 'Pending'}</option>
              <option value="APPROVED">{isBn ? 'অনুমোদিত' : 'Approved'}</option>
              <option value="REJECTED">{isBn ? 'বাতিল' : 'Rejected'}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-2 font-bold"
          >
            <Plus size={16} />
            <span>{isBn ? 'নতুন আবেদন গ্রহণ' : 'New Application'}</span>
          </Button>
          <Button 
            variant="secondary"
            onClick={() => window.print()}
            className="flex items-center gap-2 text-xs font-bold"
          >
            <Printer size={16} />
            <span>{isBn ? 'তালিকা প্রিন্ট' : 'Print List'}</span>
          </Button>
        </div>
      </div>

      {/* Job 5 (instant approve+enroll): the background cloud confirm
          failed for a just-enrolled applicant — the student sits queued
          with its amber badge in the student list. This banner offers
          Retry; it hides itself once the payload lands (here or via the
          Diagnostics queue retry). The row itself stays PENDING until
          the confirm lands, so it can never pass for enrolled. */}
      {failedEnrolls.map(({ app: failedApp, f }) => (
        <div key={failedApp.id} className="p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs sm:text-sm flex items-start gap-2.5">
          <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 leading-relaxed">
            <p className="font-semibold">{f.message}</p>
            <p className="text-amber-800 dark:text-amber-300">{isBn ? `"${f.applicantName}"-এর ভর্তির তথ্য এই ডিভাইসে সংরক্ষিত আছে — cloud-এ যায়নি।` : `The enrolment for "${f.applicantName}" is saved on this device — it has not reached the cloud yet.`}</p>
          </div>
          <button type="button" onClick={() => handleRetryEnroll(failedApp)} disabled={isRetryingId === failedApp.id} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">{RETRY_LABEL}</button>
        </div>
      ))}

      {/* Applications Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">{isBn ? 'আবেদন নং' : 'App No'}</th>
                <th className="py-3 px-4">{isBn ? 'প্রার্থীর নাম ও তথ্য' : 'Applicant'}</th>
                <th className="py-3 px-4">{isBn ? 'আবেদিত শ্রেণি' : 'Desired Class'}</th>
                <th className="py-3 px-4">{isBn ? 'পিতা ও অভিভাবক' : 'Guardian'}</th>
                <th className="py-3 px-4">{isBn ? 'মোবাইল নম্বর' : 'Phone'}</th>
                <th className="py-3 px-4">{isBn ? 'আবেদনের তারিখ' : 'Date'}</th>
                <th className="py-3 px-4 text-center">{isBn ? 'অবস্থা' : 'Status'}</th>
                <th className="py-3 px-4 text-right">{isBn ? 'অ্যাকশন' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>{isBn ? 'কোনো ভর্তি আবেদন পাওয়া যায়নি।' : 'No admission applications found.'}</p>
                  </td>
                </tr>
              ) : (
                filteredApps.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-teal-800 dark:text-teal-300">
                      {app.applicationNo}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{app.applicantNameBn || app.applicantName}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{app.applicantName} • {app.gender === 'male' ? 'ছাত্র' : 'ছাত্রী'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-bold">
                        {app.desiredClass}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-100 font-semibold">{app.fatherNameBn || app.fatherName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{app.address ? `${app.address.slice(0, 20)}...` : '—'}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-200">
                      <a href={`tel:${app.guardianPhone}`} className="hover:text-teal-700 flex items-center gap-1">
                        <Phone size={13} className="text-teal-600 dark:text-teal-400" />
                        <span>{app.guardianPhone}</span>
                      </a>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {formatSafeDate(app.appliedDate, isBn)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {app.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <Clock size={12} />
                          <span>{isBn ? 'অপেক্ষমাণ' : 'Pending'}</span>
                        </span>
                      )}
                      {/* Job 5: the student is enrolled locally but the
                          cloud confirm failed — the amber badge says so
                          instead of the row passing for enrolled. */}
                      {app.status === 'PENDING' && enrollFailures[app.id] && isRecordUnconfirmed('students', enrollFailures[app.id].studentId) && (
                        <UnconfirmedBadge isBn={isBn} />
                      )}
                      {app.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={12} />
                          <span>{isBn ? 'ভর্তি সম্পন্ন' : 'Enrolled'}</span>
                        </span>
                      )}
                      {app.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <XCircle size={12} />
                          <span>{isBn ? 'বাতিল' : 'Rejected'}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {app.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Job 5: a failed enrolment is recovered only
                              via Retry (re-confirms the same saved
                              student — never a second addStudent, never
                              a duplicate enrolment). Enroll + Reject stay
                              hidden until the failure is resolved. */}
                          {enrollFailures[app.id] ? (
                            <button
                              onClick={() => handleRetryEnroll(app)}
                              disabled={isRetryingId === app.id}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title={enrollFailures[app.id].message}
                            >
                              <span>{RETRY_LABEL}</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleApproveAndEnroll(app)}
                                disabled={enrollingAppIds.has(app.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                title={isBn ? 'অনুমোদন দিয়ে সরাসরি শিক্ষার্থী হিসেবে ভর্তি করুন' : 'Approve & Enroll as Active Student'}
                              >
                                <UserCheck size={13} />
                                <span>{enrollingAppIds.has(app.id) ? (isBn ? 'ভর্তি হচ্ছে…' : 'Enrolling…') : (isBn ? 'ভর্তি অনুমোদন' : 'Enroll')}</span>
                              </button>
                              <button
                                onClick={() => handleReject(app.id)}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 text-slate-600 dark:text-slate-300 hover:text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer"
                                title={isBn ? 'বাতিল করুন' : 'Reject'}
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">{isBn ? 'কার্যকর হয়েছে' : 'Processed'}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intake Modal for New Walk-in / Manual Application */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-teal-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl">
                  <Plus size={20} className="text-teal-200" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{isBn ? 'নতুন ভর্তি আবেদন ফরম' : 'New Admission Intake Form'}</h3>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 hover:bg-white/15 rounded-lg text-teal-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 dark:text-slate-200 block mb-1">{isBn ? 'প্রার্থীর নাম (বাংলায়) *' : 'Applicant Name (BN) *'}</label>
                  <input 
                    type="text" 
                    required
                    value={formData.applicantNameBn}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicantNameBn: e.target.value }))}
                    placeholder="আব্দুল্লাহ আল মাহমুদ"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-200 block mb-1">{isBn ? 'প্রার্থীর নাম (English) *' : 'Applicant Name (EN) *'}</label>
                  <input 
                    type="text" 
                    required
                    value={formData.applicantName}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicantName: e.target.value }))}
                    placeholder="Abdullah Al Mahmud"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-200 block mb-1">{isBn ? 'আবেদিত শ্রেণি *' : 'Desired Class *'}</label>
                  <select
                    value={formData.desiredClass}
                    onChange={(e) => setFormData(prev => ({ ...prev, desiredClass: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-teal-500"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-200 block mb-1">{isBn ? 'লিঙ্গ' : 'Gender'}</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="male">{isBn ? 'ছাত্র (Male)' : 'Male'}</option>
                    <option value="female">{isBn ? 'ছাত্রী (Female)' : 'Female'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-200 block mb-1">{isBn ? 'পিতার নাম' : "Father's Name"}</label>
                  <input 
                    type="text"
                    value={formData.fatherNameBn}
                    onChange={(e) => setFormData(prev => ({ ...prev, fatherNameBn: e.target.value, fatherName: e.target.value }))}
                    placeholder="পিতার নাম"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-200 block mb-1">{isBn ? 'মাতার নাম' : "Mother's Name"}</label>
                  <input 
                    type="text"
                    value={formData.motherName}
                    onChange={(e) => setFormData(prev => ({ ...prev, motherName: e.target.value }))}
                    placeholder="মাতার নাম"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-200 block mb-1">{isBn ? 'অভিভাবকের মোবাইল নম্বর *' : 'Guardian Phone *'}</label>
                  <input 
                    type="tel"
                    required
                    value={formData.guardianPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, guardianPhone: e.target.value }))}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-200 block mb-1">{isBn ? 'পূর্ববর্তী মাদ্রাসা / স্কুল' : 'Previous School'}</label>
                  <input 
                    type="text"
                    value={formData.previousSchool}
                    onChange={(e) => setFormData(prev => ({ ...prev, previousSchool: e.target.value }))}
                    placeholder="নূরানী মাদ্রাসা..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-200 block mb-1">{isBn ? 'স্থায়ী ঠিকানা' : 'Address'}</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="গ্রাম, ডাকঘর, উপজেলা, জেলা..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                  {isBn ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white font-bold">
                  {isBn ? 'আবেদন সংরক্ষণ করুন' : 'Save Application'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
