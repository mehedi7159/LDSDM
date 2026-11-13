import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  dailyAttendanceService,
  isFridayDate,
  validateRemarkAttendance,
  cappedAttendanceRate,
  DailyStudentAttendanceRecord,
  DailyStaffAttendanceRecord,
  AttendanceStatus
} from '../../services/dailyAttendanceService';
import { formatNumber, formatSafeDate } from '../../services/utils';
import { ATTENDANCE_CLOUD_FAILURE_MESSAGE, RETRY_LABEL } from '../../services/cloudConfirm';
import { UnconfirmedBadge } from '../ui/UnconfirmedBadge';
import { Button } from '../ui/Button';
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Users, 
  UserCheck, 
  UserX, 
  Phone, 
  MessageSquare, 
  Printer, 
  Download, 
  Sparkles, 
  Save, 
  RotateCcw,
  GraduationCap,
  Briefcase,
  Check,
  Send,
  HelpCircle,
  Copy,
  ExternalLink,
  Share2,
  FileText,
  Loader2,
  Award,
  Edit3
} from 'lucide-react';

interface DailyAttendanceHubProps {
  onNavigateTab?: (tab: string) => void;
  initialMode?: 'students' | 'staff' | 'absentees' | 'sync_exam';
  hideTopSwitcher?: boolean;
}

export const DailyAttendanceHub: React.FC<DailyAttendanceHubProps> = ({ 
  onNavigateTab, 
  initialMode = 'students',
  hideTopSwitcher = false
}) => {
  const { 
    students = [], 
    classes = [], 
    teachers = [], 
    dailyStudentAttendance = [],
    dailyStaffAttendance = [],
    hasPermission,
    confirmAttendanceCloudSync,
    confirmStaffAttendanceCloudSync,
    isRecordUnconfirmed,
    exams = [], 
    remarks = [], 
    updateRemark, 
    schoolProfile, 
    language, 
    t 
  } = useApp();
  const isBn = language === 'bn';

  const [activeMode, setActiveMode] = useState<'students' | 'staff' | 'absentees' | 'sync_exam'>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setActiveMode(initialMode);
    }
  }, [initialMode]);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  // Master audit F5: Friday is the weekly holiday — the picker refuses
  // it and the saves refuse it too (a Friday can still be the initial
  // date when the Hub opens on a Friday). One message, shown by the
  // date picker, so the admin sees why nothing saved.
  const [fridayNotice, setFridayNotice] = useState<string | null>(() =>
    isFridayDate(new Date().toISOString().split('T')[0])
      ? 'শুক্রবার সাপ্তাহিক ছুটি — এই দিনে হাজিরা নেওয়া হয় না।'
      : null
  );
  const handleDateChange = (value: string) => {
    if (isFridayDate(value)) {
      setFridayNotice('শুক্রবার সাপ্তাহিক ছুটি — এই দিনে হাজিরা নেওয়া হয় না।');
      return;
    }
    setFridayNotice(null);
    setSelectedDate(value);
  };
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '১ম শ্রেণি');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 7 Nov 2026 Job 7 (staff attendance ONLY — the student save above is
  // untouched): instant/optimistic staff save. The old staff path
  // block-awaited the cloud confirm and on failure showed only a
  // generic 5-second button label. Now the local save applies at once,
  // the confirm runs in the BACKGROUND, and a failure stays visible as
  // a persistent amber banner + per-row 'cloud-এ যায়নি' badges until
  // it is retried or lands. No timeout ever clears the error.
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffSyncing, setStaffSyncing] = useState(false);
  const [staffRetrying, setStaffRetrying] = useState(false);
  const [staffSaveError, setStaffSaveError] = useState<string | null>(null);
  const [staffSavedJustNow, setStaffSavedJustNow] = useState(false);
  const staffSaveInFlightRef = useRef(false);

  // Plain-language confirm failure: a timeout (slow connection) says so
  // explicitly instead of the generic cloud message.
  const staffConfirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the save did not finish. Try again on a better connection.')
      : (result.message || ATTENDANCE_CLOUD_FAILURE_MESSAGE));

  // Enrolled active students in selected class
  const classStudents = useMemo(() => {
    return students
      .filter(s => (s.classLevel === selectedClass || s.classId === selectedClass) && !s.isFormer && s.status !== 'Former')
      .sort((a, b) => (Number(a.roll || a.rollNumber || '0') || 0) - (Number(b.roll || b.rollNumber || '0') || 0));
  }, [students, selectedClass]);

  // Current attendance map for students: studentId -> status
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; timeIn?: string; note?: string }>>({});

  // Staff attendance map: staffId -> status
  const [staffAttendanceMap, setStaffAttendanceMap] = useState<Record<string, { status: AttendanceStatus; inTime?: string; outTime?: string; note?: string }>>({});

  // SAVED records for the selected date (+class) — the only source the
  // summary strip may present as fact. The working maps above are
  // pre-filled with PRESENT defaults to make taking attendance one-tap;
  // counting them would invent attendance that was never recorded.
  // Step 3: derived from the SHARED context arrays (not the service
  // singleton, not local state) with the exact service predicates, so
  // the strip refreshes when another device's attendance lands in the
  // cloud. Post-save refreshes are unnecessary — the bridge mirrors
  // every service write into context, so the memo recomputes on save.
  const savedStudentRecords = useMemo(() => dailyStudentAttendance.filter(
    r => r.date === selectedDate && (selectedClass === 'All' || r.classLevel === selectedClass)
  ), [dailyStudentAttendance, selectedDate, selectedClass]);
  const savedStaffRecords = useMemo(() => dailyStaffAttendance.filter(
    r => r.date === selectedDate
  ), [dailyStaffAttendance, selectedDate]);

  // Today's saved staff records still sitting in the payload queue
  // (i.e. local-only). The banner shows while any of them is
  // unconfirmed, so it survives a remount and hides only once the
  // payload lands — here or via the Diagnostics queue retry.
  const staffUnconfirmedToday = useMemo(() =>
    savedStaffRecords.some(r => isRecordUnconfirmed('dailyStaffAttendance', r.id)),
    [savedStaffRecords, isRecordUnconfirmed]);

  // Load student attendance for selectedDate & selectedClass
  // Step 3: edit maps initialize from the shared-context derivation.
  // Deps deliberately exclude the context arrays: a cloud arrival
  // mid-edit must not clobber the admin's unsaved taps (the summary
  // strip above stays reactive through the memo itself).
  useEffect(() => {
    const records = savedStudentRecords;
    const newMap: Record<string, { status: AttendanceStatus; timeIn?: string; note?: string }> = {};

    classStudents.forEach(student => {
      const existing = records.find(r => r.studentId === student.id);
      if (existing) {
        newMap[student.id] = {
          status: existing.status,
          timeIn: existing.timeIn,
          note: existing.note
        };
      } else {
        // Default to PRESENT for easy 1-click taking
        newMap[student.id] = {
          status: 'PRESENT',
          timeIn: '08:00 AM',
          note: ''
        };
      }
    });

    setAttendanceMap(newMap);
  }, [selectedDate, selectedClass, classStudents]);

  // Load staff attendance for selectedDate
  // Step 3: same editor-state protection as the student map above.
  // Master audit F1: ONLY already-saved records load into the map.
  // An unmarked teacher gets no entry — the old code pre-filled every
  // unmarked teacher as PRESENT, so one Save recorded the whole staff
  // present without anyone marking them.
  useEffect(() => {
    const records = savedStaffRecords;
    const newStaffMap: Record<string, { status: AttendanceStatus; inTime?: string; outTime?: string; note?: string }> = {};

    teachers.forEach(teacher => {
      const existing = records.find(r => r.staffId === teacher.id);
      if (existing) {
        newStaffMap[teacher.id] = {
          status: existing.status,
          inTime: existing.inTime,
          outTime: existing.outTime,
          note: existing.note
        };
      }
    });

    setStaffAttendanceMap(newStaffMap);
  }, [selectedDate, teachers]);

  // Quick Action: Mark All Present
  const handleMarkAllPresent = () => {
    setAttendanceMap(prev => {
      const updated = { ...prev };
      classStudents.forEach(s => {
        updated[s.id] = { ...updated[s.id], status: 'PRESENT' };
      });
      return updated;
    });
  };

  // Quick Action: Mark All Absent
  const handleMarkAllAbsent = () => {
    setAttendanceMap(prev => {
      const updated = { ...prev };
      classStudents.forEach(s => {
        updated[s.id] = { ...updated[s.id], status: 'ABSENT' };
      });
      return updated;
    });
  };

  // Change individual student status
  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
  };

  // Save student attendance — local save first (never dropped), then
  // the cloud confirm is AWAITED: 'saved' shows only after the cloud
  // write succeeds, otherwise the error state shows and the confirm
  // queue keeps the records for retry.
  const handleSaveStudentAttendance = async () => {
    // Master audit F5: Friday is never a working day.
    if (isFridayDate(selectedDate)) {
      setFridayNotice('শুক্রবার সাপ্তাহিক ছুটি — এই দিনে হাজিরা নেওয়া হয় না।');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
      return;
    }
    setSaveStatus('saving');
    const recordsToSave: DailyStudentAttendanceRecord[] = classStudents.map(student => {
      const current = attendanceMap[student.id] || { status: 'PRESENT' };
      return {
        id: `${selectedDate}_${student.id}`,
        date: selectedDate,
        studentId: student.id,
        studentName: student.nameBn || student.name,
        roll: student.roll || student.rollNumber,
        classLevel: student.classLevel,
        status: current.status,
        timeIn: current.timeIn,
        note: current.note
      };
    });

    dailyAttendanceService.batchSaveStudentAttendance(recordsToSave);
    let confirmed = false;
    if (confirmAttendanceCloudSync) {
      const result = await confirmAttendanceCloudSync();
      confirmed = result.success;
    }
    setSaveStatus(confirmed ? 'saved' : 'error');
    setTimeout(() => setSaveStatus('idle'), confirmed ? 2500 : 5000);
  };

  // Save staff attendance — INSTANT/OPTIMISTIC (Job 7, staff only):
  // the local save applies at once and the UI responds immediately;
  // the cloud confirm NEVER blocks this handler — it runs in the
  // background. On failure the confirm queues the payload (via
  // confirmUpsertFailure), the rows show the amber 'cloud-এ যায়নি'
  // badge, and the persistent banner below offers Retry. The instant
  // response means 'saved on this device, syncing' — never a false
  // 'saved to cloud'. The 'সংরক্ষিত হয়েছে' note appears only after
  // the background confirm actually succeeds.
  const handleSaveStaffAttendance = () => {
    // Master audit F1: staff attendance is admin-only (principal's
    // 25-Oct-2026 rule). Re-checked here, not just at the route/tab —
    // the Hub is also embedded from StaffManager, so the save itself
    // must refuse a non-admin.
    if (!hasPermission('staff.attendance.manage')) {
      setStaffSaveError(isBn ? 'স্টাফ হাজিরা শুধু অ্যাডমিন সংরক্ষণ করতে পারেন।' : 'Only an admin can save staff attendance.');
      return;
    }
    // Master audit F5: Friday is never a working day.
    if (isFridayDate(selectedDate)) {
      setFridayNotice('শুক্রবার সাপ্তাহিক ছুটি — এই দিনে হাজিরা নেওয়া হয় না।');
      setStaffSaveError('শুক্রবার সাপ্তাহিক ছুটি — এই দিনে হাজিরা নেওয়া হয় না।');
      return;
    }
    if (staffSaveInFlightRef.current || staffSyncing) return;
    staffSaveInFlightRef.current = true;
    setStaffSaving(true);
    setStaffSaveError(null);
    setStaffSavedJustNow(false);
    // ONLY teachers the admin explicitly marked (a map entry) are
    // saved. An unmarked teacher is never defaulted to PRESENT.
    const markedTeachers = teachers.filter(teacher => staffAttendanceMap[teacher.id]);
    if (markedTeachers.length === 0) {
      staffSaveInFlightRef.current = false;
      setStaffSaving(false);
      setStaffSaveError(isBn ? 'কাউকে চিহ্নিত করা হয়নি — সংরক্ষণের আগে অন্তত একজন শিক্ষক/কর্মীর হাজিরা চিহ্নিত করুন।' : 'Nobody is marked — mark at least one staff member before saving.');
      return;
    }
    const recordsToSave: DailyStaffAttendanceRecord[] = markedTeachers.map(teacher => {
      const current = staffAttendanceMap[teacher.id];
      return {
        id: `${selectedDate}_${teacher.id}`,
        date: selectedDate,
        staffId: teacher.id,
        staffName: teacher.name,
        designation: teacher.designation || 'শিক্ষক',
        // An entry with no status (e.g. only a time/note was typed)
        // means the admin touched the row — count it present.
        status: current.status || 'PRESENT',
        inTime: current.inTime,
        outTime: current.outTime,
        note: current.note
      };
    });

    // Local mutation first — synchronous, so the save lands on this
    // device at once. Step 3: no manual refresh — the context
    // derivation above recomputes from the mirrored write.
    dailyAttendanceService.batchSaveStaffAttendance(recordsToSave);
    setStaffSaving(false);
    staffSaveInFlightRef.current = false;

    // Background confirm — fire and forget from the UI's point of
    // view. The save button stays disabled while it is in flight
    // (double-submit guard); Retry lives in the banner below.
    if (!confirmStaffAttendanceCloudSync) return;
    setStaffSyncing(true);
    void confirmStaffAttendanceCloudSync().then((result) => {
      setStaffSyncing(false);
      if (result.success) {
        setStaffSaveError(null);
        setStaffSavedJustNow(true);
        setTimeout(() => setStaffSavedJustNow(false), 2500);
      } else {
        setStaffSaveError(staffConfirmErrorMessage(result));
      }
    }).catch((err) => {
      console.error('Background staff attendance cloud confirm failed:', err);
      setStaffSyncing(false);
      setStaffSaveError(ATTENDANCE_CLOUD_FAILURE_MESSAGE);
    });
  };

  // Retry re-runs ONLY the cloud confirm for the already-saved staff
  // records — never a second local write. The Diagnostics queue retry
  // covers the same payload, so whichever lands first clears the
  // badges (the banner hides once isRecordUnconfirmed turns false).
  const handleRetryStaffAttendanceSave = async () => {
    if (staffRetrying || !confirmStaffAttendanceCloudSync) return;
    setStaffRetrying(true);
    try {
      const result = await confirmStaffAttendanceCloudSync();
      if (result.success) {
        setStaffSaveError(null);
        setStaffSavedJustNow(true);
        setTimeout(() => setStaffSavedJustNow(false), 2500);
      } else {
        setStaffSaveError(staffConfirmErrorMessage(result));
      }
    } catch (err) {
      console.error('Staff attendance retry failed:', err);
      setStaffSaveError(ATTENDANCE_CLOUD_FAILURE_MESSAGE);
    } finally {
      setStaffRetrying(false);
    }
  };

  // Auto-Rollup: Calculate attendance from Daily Records into Exam Remarks
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // SMS Modal State
  const [isSmsModalOpen, setIsSmsModalOpen] = useState<boolean>(false);
  const [smsCopiedNotice, setSmsCopiedNotice] = useState<string | null>(null);
  const [customSmsText, setCustomSmsText] = useState<string>('');

  // Remarks Table State & Auto-save for Exam Rollup / Fine-Tuning
  const [localRemarksData, setLocalRemarksData] = useState<Record<string, { workingDays?: number; totalPresent?: number; totalAbsent?: number; remark?: string }>>({});
  // Master audit F10: studentId -> why this student's triple cannot
  // be saved (shown above the remarks table until fixed).
  const [remarksWarnings, setRemarksWarnings] = useState<Record<string, string>>({});
  const pendingRemarksRef = useRef<Record<string, any>>({});
  const remarksSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [remarksSaveStatus, setRemarksSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');

  // Load remarks for selectedExamId & classStudents
  useEffect(() => {
    if (!selectedExamId) return;
    const initialData: Record<string, any> = {};
    classStudents.forEach(st => {
      const existing = remarks.find(r => r.studentId === st.id && r.examId === selectedExamId);
      initialData[st.id] = {
        workingDays: existing?.workingDays ?? undefined,
        totalPresent: existing?.totalPresent ?? undefined,
        totalAbsent: existing?.totalAbsent ?? undefined,
        remark: existing?.remark ?? ''
      };
    });
    setLocalRemarksData(initialData);
    setRemarksSaveStatus('saved');
  }, [selectedExamId, selectedClass, classStudents, remarks]);

  const flushRemarksSave = () => {
    if (remarksSaveTimeoutRef.current) {
      clearTimeout(remarksSaveTimeoutRef.current);
      remarksSaveTimeoutRef.current = null;
    }
    if (!selectedExamId) return;

    const studentIds = Object.keys(pendingRemarksRef.current);
    if (studentIds.length === 0) return;

    studentIds.forEach(studentId => {
      const data = pendingRemarksRef.current[studentId];
      if (data) {
        // Master audit F10: re-validate at flush time — an invalid
        // triple is never handed to updateRemark, even if it was
        // queued before the warning state existed.
        const problem = validateRemarkAttendance(data.workingDays, data.totalPresent, data.totalAbsent);
        if (problem) {
          setRemarksWarnings(w => ({ ...w, [studentId]: problem }));
          return;
        }
        updateRemark(studentId, selectedExamId, {
          workingDays: data.workingDays,
          totalPresent: data.totalPresent,
          totalAbsent: data.totalAbsent,
          remark: data.remark
        });
      }
    });

    pendingRemarksRef.current = {};
    setRemarksSaveStatus('saved');
  };

  const handleRemarkFieldChange = (studentId: string, field: 'workingDays' | 'totalPresent' | 'totalAbsent' | 'remark', value: string) => {
    setRemarksSaveStatus('saving');
    setLocalRemarksData(prev => {
      const current = prev[studentId] || {};
      const parsed = field === 'remark' ? value : (value === '' ? undefined : Number(value));
      const updated = { ...current, [field]: parsed };
      // Master audit F10: an impossible triple (present + absent >
      // working days, or any negative) is warned about and NEVER
      // queued for save — it must not silently land on the marksheet.
      // The typed value stays visible so the admin can fix it.
      if (field !== 'remark') {
        const problem = validateRemarkAttendance(updated.workingDays, updated.totalPresent, updated.totalAbsent);
        if (problem) {
          setRemarksWarnings(w => ({ ...w, [studentId]: problem }));
          delete pendingRemarksRef.current[studentId];
          return { ...prev, [studentId]: updated };
        }
        setRemarksWarnings(w => {
          if (!(studentId in w)) return w;
          const next = { ...w };
          delete next[studentId];
          return next;
        });
      }
      pendingRemarksRef.current[studentId] = updated;

      if (remarksSaveTimeoutRef.current) clearTimeout(remarksSaveTimeoutRef.current);
      remarksSaveTimeoutRef.current = setTimeout(() => {
        flushRemarksSave();
      }, 400);

      return { ...prev, [studentId]: updated };
    });
  };

  const handleApplyPresetRemark = (studentId: string, presetText: string) => {
    handleRemarkFieldChange(studentId, 'remark', presetText);
  };

  const handleSyncToExam = () => {
    if (!selectedExamId) {
      setSyncStatus(isBn ? 'অনুগ্রহ করে একটি পরীক্ষা নির্বাচন করুন।' : 'Please select an exam.');
      setTimeout(() => setSyncStatus(null), 3000);
      return;
    }

    let updatedCount = 0;
    const newLocalData = { ...localRemarksData };

    classStudents.forEach(student => {
      const autoData = dailyAttendanceService.calculateStudentAttendanceForExam(student.id);
      const remarkText = autoData.attendancePercentage >= 90 
        ? (isBn ? 'খুব ভালো ও নিয়মিত' : 'Excellent') 
        : (autoData.attendancePercentage >= 75 ? (isBn ? 'সন্তোষজনক' : 'Good') : (isBn ? 'উপস্থিতি বৃদ্ধি প্রয়োজন' : 'Needs Improvement'));
      
      updateRemark(student.id, selectedExamId, {
        workingDays: autoData.workingDays,
        totalPresent: autoData.totalPresent,
        totalAbsent: autoData.totalAbsent,
        remark: remarkText
      });

      newLocalData[student.id] = {
        workingDays: autoData.workingDays,
        totalPresent: autoData.totalPresent,
        totalAbsent: autoData.totalAbsent,
        remark: remarkText
      };
      updatedCount++;
    });

    setLocalRemarksData(newLocalData);
    setSyncStatus(isBn 
      ? `সফলভাবে ${formatNumber(updatedCount, language)} জন শিক্ষার্থীর উপস্থিতি পরীক্ষার মার্কশিটে যুক্ত করা হয়েছে!` 
      : `Successfully synced attendance for ${updatedCount} students to exam marksheet!`
    );
    setTimeout(() => setSyncStatus(null), 4000);
  };

  // Computed summary metrics — RECORDED DATA ONLY (owner rule).
  // A previous version counted the working attendanceMap, which is
  // pre-filled with PRESENT defaults for one-tap taking, so an untouched
  // class reported 100% present / a fabricated rate. These figures now
  // come from the saved records for this date+class; the rate is over
  // recorded entries only, and is null until something is recorded.
  const summary = useMemo(() => {
    const total = classStudents.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    savedStudentRecords.forEach(r => {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'LEAVE') leave++;
    });

    const recorded = savedStudentRecords.length;
    const percentage = recorded > 0 ? Math.round(((present + late) / recorded) * 100) : null;
    return {
      total, present, absent, late, leave,
      recorded,
      pending: Math.max(0, total - recorded),
      percentage
    };
  }, [classStudents, savedStudentRecords]);

  // Staff summary for the same date (saved records only — unmarked staff are
  // never counted as present). Powers the metrics strip in staff mode.
  const staffSummary = useMemo(() => {
    const total = teachers.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    savedStaffRecords.forEach(r => {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'LEAVE') leave++;
    });
    const recorded = savedStaffRecords.length;
    const percentage = recorded > 0 ? Math.round(((present + late) / recorded) * 100) : null;
    return {
      total, present, absent, late, leave,
      recorded,
      pending: Math.max(0, total - recorded),
      percentage
    };
  }, [teachers, savedStaffRecords]);

  // The strip follows the active mode: staff numbers in staff mode, class
  // numbers everywhere else (students / absentees / sync).
  const stripSummary = activeMode === 'staff' ? staffSummary : summary;

  // Filtered students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase().trim();
    return classStudents.filter(s => 
      s.name.toLowerCase().includes(q) ||
      (s.nameBn && s.nameBn.includes(q)) ||
      (s.roll && String(s.roll).includes(q)) ||
      (s.studentId && s.studentId.toLowerCase().includes(q)) ||
      (s.guardianPhone && s.guardianPhone.includes(q))
    );
  }, [classStudents, searchQuery]);

  // List of absent students
  const absentStudents = useMemo(() => {
    return classStudents.filter(s => {
      const st = attendanceMap[s.id]?.status;
      return st === 'ABSENT' || st === 'LEAVE';
    });
  }, [classStudents, attendanceMap]);

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Mode Switcher */}
      {!hideTopSwitcher && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-600 text-white rounded-2xl">
                <Calendar size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight font-bangla">
                  {isBn ? '৪. দৈনিক উপস্থিতি ব্যবস্থাপনা' : '4. Daily Attendance Management'}
                </h2>
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold w-full md:w-auto">
            <button
              onClick={() => setActiveMode('students')}
              className={`py-2 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeMode === 'students' ? 'bg-white text-teal-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={15} />
              <span>{isBn ? 'শিক্ষার্থী' : 'Students'}</span>
            </button>
            <button
              onClick={() => setActiveMode('staff')}
              className={`py-2 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeMode === 'staff' ? 'bg-white text-teal-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase size={15} />
              <span>{isBn ? 'স্টাফ' : 'Staff'}</span>
            </button>
            <button
              onClick={() => setActiveMode('absentees')}
              className={`py-2 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeMode === 'absentees' ? 'bg-white text-rose-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserX size={15} />
              <span>{isBn ? 'অনুপস্থিত' : 'Absentees'}</span>
              {absentStudents.length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded-full text-[10px]">
                  {formatNumber(absentStudents.length, language)}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveMode('sync_exam')}
              className={`py-2 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeMode === 'sync_exam' ? 'bg-white text-indigo-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={15} />
              <span>{isBn ? 'সিঙ্ক' : 'Exam Sync'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Summary Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase">{activeMode === 'staff' ? (isBn ? 'মোট স্টাফ' : 'Total staff') : (isBn ? 'মোট শিক্ষার্থী' : 'Total')}</span>
          <p className="text-2xl font-black text-slate-800 mt-1 font-bangla">{formatNumber(stripSummary.total, language)}</p>
          <span className="text-[10px] text-teal-700 font-semibold">{activeMode === 'staff' ? (isBn ? 'শিক্ষক ও কর্মী' : 'Teachers & staff') : selectedClass}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-700 uppercase">{isBn ? 'উপস্থিত' : 'Present'}</span>
          <p className="text-2xl font-black text-emerald-900 mt-1 font-bangla">{stripSummary.recorded > 0 ? formatNumber(stripSummary.present, language) : '—'}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-rose-200 bg-rose-50/20">
          <span className="text-[11px] font-bold text-rose-700 uppercase">{isBn ? 'অনুপস্থিত' : 'Absent'}</span>
          <p className="text-2xl font-black text-rose-900 mt-1 font-bangla">{stripSummary.recorded > 0 ? formatNumber(stripSummary.absent, language) : '—'}</p>
          <span className="text-[10px] text-rose-700 font-semibold">{isBn ? 'অনুমতি ছাড়া' : 'Unexcused'}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 bg-amber-50/20">
          <span className="text-[11px] font-bold text-amber-700 uppercase">{isBn ? 'বিলম্বিত' : 'Late'}</span>
          <p className="text-2xl font-black text-amber-900 mt-1 font-bangla">{stripSummary.recorded > 0 ? formatNumber(stripSummary.late, language) : '—'}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/20">
          <span className="text-[11px] font-bold text-indigo-700 uppercase">{isBn ? 'ছুটি / মার্জিত' : 'Leave'}</span>
          <p className="text-2xl font-black text-indigo-900 mt-1 font-bangla">{stripSummary.recorded > 0 ? formatNumber(stripSummary.leave, language) : '—'}</p>
          <span className="text-[10px] text-indigo-700 font-semibold">{isBn ? 'দরখাস্ত গৃহীত' : 'Approved Leave'}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-300 bg-slate-50/40">
          <span className="text-[11px] font-bold text-slate-600 uppercase">{isBn ? 'চিহ্নিত হয়নি' : 'Unmarked'}</span>
          <p className="text-2xl font-black text-slate-800 mt-1 font-bangla">{formatNumber(stripSummary.pending, language)}</p>
          <span className="text-[10px] text-slate-500 font-semibold">{stripSummary.recorded === 0 ? (isBn ? 'হাজিরা নেওয়া হয়নি' : 'Not taken yet') : (isBn ? 'এখনো চিহ্নিত হয়নি' : 'Not marked yet')}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-teal-200 bg-teal-50/30">
          <span className="text-[11px] font-bold text-teal-700 uppercase">{isBn ? 'উপস্থিতির হার' : 'Rate'}</span>
          {stripSummary.percentage !== null ? (
            <>
              <p className="text-2xl font-black text-teal-900 mt-1 font-bangla">{formatNumber(stripSummary.percentage, language)}%</p>
              <span className="text-[10px] text-teal-700 font-semibold">{isBn ? `রেকর্ডকৃত ${formatNumber(stripSummary.recorded, language)} জনের ভিত্তিতে` : `Based on ${formatNumber(stripSummary.recorded, language)} recorded`}</span>
            </>
          ) : (
            <p className="text-sm font-black text-amber-600 mt-1.5">{isBn ? 'হাজিরা নেওয়া হয়নি' : 'Not taken yet'}</p>
          )}
        </div>
      </div>

      {/* 3. Controls Bar: Date, Class, Quick Bulk Actions */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full">
          {/* Date Picker */}
          <div className="w-44 shrink-0">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">{isBn ? 'তারিখ' : 'Date'}</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
            />
            {fridayNotice && (
              <p className="text-[11px] font-bold text-amber-700 mt-1">{fridayNotice}</p>
            )}
          </div>

          {/* Class Selector (for Students mode) */}
          {activeMode !== 'staff' && (
            <div className="w-48 shrink-0">
              <label className="text-[11px] font-bold text-slate-500 block mb-1">{isBn ? 'শ্রেণি / জামাত' : 'Class'}</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search Query */}
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">{isBn ? 'খোঁজ' : 'Search'}</label>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'নাম, রোল বা মোবাইল দিয়ে খুঁজুন...' : 'Search student or phone...'}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Quick Bulk Actions */}
        <div className="flex items-center gap-2 shrink-0 pt-4 md:pt-0">
          {activeMode === 'students' && (
            <>
              <button
                onClick={handleMarkAllPresent}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title={isBn ? 'সকলকে উপস্থিত হিসেবে চিহ্নিত করুন' : 'Mark all present'}
              >
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>{isBn ? 'সবাই উপস্থিত' : 'All Present'}</span>
              </button>
              <button
                onClick={handleMarkAllAbsent}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title={isBn ? 'সকলকে অনুপস্থিত হিসেবে চিহ্নিত করুন' : 'Mark all absent'}
              >
                <XCircle size={14} className="text-rose-600" />
                <span>{isBn ? 'সবাই অনুপস্থিত' : 'All Absent'}</span>
              </button>
              <Button
                onClick={handleSaveStudentAttendance}
                disabled={saveStatus === 'saving'}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center gap-2"
              >
                <Save size={16} />
                <span>{saveStatus === 'saved' ? (isBn ? 'সংরক্ষিত হয়েছে!' : 'Saved!') : saveStatus === 'error' ? (isBn ? 'সংরক্ষণ ব্যর্থ — আবার চেষ্টা করুন' : 'Save failed — try again') : (isBn ? 'হাজিরা সংরক্ষণ' : 'Save')}</span>
              </Button>
            </>
          )}

          {activeMode === 'staff' && (
            <Button
              onClick={handleSaveStaffAttendance}
              disabled={staffSaving || staffSyncing || staffRetrying}
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center gap-2"
            >
              <Save size={16} />
              <span>{staffSyncing ? (isBn ? 'cloud-এ যাচ্ছে…' : 'Syncing to cloud…') : (isBn ? 'স্টাফ হাজিরা সংরক্ষণ' : 'Save Staff')}</span>
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <Printer size={15} />
            <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
          </Button>
        </div>
      </div>

      {/* Job 7 (staff only): persistent failure banner + honest sync
          feedback. The banner shows while any of today's staff records
          is still queued (local-only) and hides only once the payload
          lands — no timeout ever clears it. The syncing note means
          'saved on this device, syncing'; 'সংরক্ষিত হয়েছে' appears
          only after the background confirm succeeds. */}
      {activeMode === 'staff' && staffUnconfirmedToday && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 leading-relaxed">
            <p className="font-semibold">{staffSaveError || ATTENDANCE_CLOUD_FAILURE_MESSAGE}</p>
            <p className="text-amber-800">{isBn ? 'স্টাফ হাজিরা এই ডিভাইসে সংরক্ষিত আছে — cloud-এ যায়নি।' : 'Staff attendance is saved on this device — it has not reached the cloud yet.'}</p>
          </div>
          <button
            type="button"
            onClick={handleRetryStaffAttendanceSave}
            disabled={staffRetrying || staffSyncing}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {RETRY_LABEL}
          </button>
        </div>
      )}
      {activeMode === 'staff' && staffSyncing && (
        <div className="p-3.5 bg-teal-50 border border-teal-200 text-teal-800 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2">
          <Loader2 size={16} className="animate-spin shrink-0" />
          <span>{isBn ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…'}</span>
        </div>
      )}
      {activeMode === 'staff' && staffSavedJustNow && !staffSyncing && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{isBn ? 'স্টাফ হাজিরা cloud-এ সংরক্ষিত হয়েছে।' : 'Staff attendance saved to cloud.'}</span>
        </div>
      )}

      {/* 4. MODE 1: Student Daily Attendance List */}
      {activeMode === 'students' && (
        <div className="mobile-responsive-table bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={17} className="text-teal-700" />
              <h3 className="text-sm font-bold text-slate-800">
                {selectedClass} • {formatSafeDate(selectedDate, isBn)} ({formatNumber(filteredStudents.length, language)} {isBn ? 'জন শিক্ষার্থী' : 'students'})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all print:hidden"
              title={isBn ? 'হাজিরা তালিকা প্রিন্ট করুন' : 'Print attendance list'}
            >
              <Printer size={13} />
              <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">{isBn ? 'রোল' : 'Roll'}</th>
                  <th className="py-3 px-4">{isBn ? 'শিক্ষার্থীর নাম ও আইডি' : 'Student & ID'}</th>
                  <th className="py-3 px-4 text-center">{isBn ? 'উপস্থিতি নির্ধারণ (Status)' : 'Attendance Status'}</th>
                  <th className="py-3 px-4">{isBn ? 'প্রবেশ সময়' : 'Time In'}</th>
                  <th className="py-3 px-4">{isBn ? 'অভিভাবকের যোগাযোগ' : 'Guardian Contact'}</th>
                  <th className="py-3 px-4">{isBn ? 'মন্তব্য / নোট' : 'Note'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>{isBn ? 'এই শ্রেণিতে কোনো সক্রিয় শিক্ষার্থী পাওয়া যায়নি।' : 'No students found in this class.'}</p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => {
                    const current = attendanceMap[student.id] || { status: 'PRESENT' };
                    const currentStatus = current.status;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                          {student.roll || student.rollNumber || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{student.nameBn || student.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">আইডি: {student.studentId || student.id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            {/* PRESENT */}
                            <button
                              onClick={() => handleSetStudentStatus(student.id, 'PRESENT')}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                                currentStatus === 'PRESENT'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              <CheckCircle2 size={13} />
                              <span>{isBn ? 'উপস্থিত' : 'Present'}</span>
                            </button>

                            {/* ABSENT */}
                            <button
                              onClick={() => handleSetStudentStatus(student.id, 'ABSENT')}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                                currentStatus === 'ABSENT'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                            >
                              <XCircle size={13} />
                              <span>{isBn ? 'অনুপস্থিত' : 'Absent'}</span>
                            </button>

                            {/* LATE */}
                            <button
                              onClick={() => handleSetStudentStatus(student.id, 'LATE')}
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                                currentStatus === 'LATE'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                              }`}
                              title={isBn ? 'বিলম্বিত' : 'Late'}
                            >
                              <Clock size={13} />
                              <span>{isBn ? 'বিলম্ব' : 'Late'}</span>
                            </button>

                            {/* LEAVE */}
                            <button
                              onClick={() => handleSetStudentStatus(student.id, 'LEAVE')}
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                                currentStatus === 'LEAVE'
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                              }`}
                              title={isBn ? 'ছুটি / মার্জিত' : 'Leave'}
                            >
                              <span>{isBn ? 'ছুটি' : 'Leave'}</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          <input 
                            type="text"
                            value={current.timeIn || '08:00 AM'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAttendanceMap(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], timeIn: val }
                              }));
                            }}
                            className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </td>
                        <td className="py-3 px-4">
                          {student.guardianPhone ? (
                            <a 
                              href={`tel:${student.guardianPhone}`} 
                              className="text-teal-700 hover:underline font-mono font-bold flex items-center gap-1"
                            >
                              <Phone size={12} />
                              <span>{student.guardianPhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <input 
                            type="text"
                            value={current.note || ''}
                            placeholder={isBn ? 'নোট...' : 'Note...'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAttendanceMap(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], note: val }
                              }));
                            }}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. MODE 2: Staff / Teacher Attendance */}
      {activeMode === 'staff' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase size={17} className="text-teal-700" />
              <h3 className="text-sm font-bold text-slate-800">
                {isBn ? 'শিক্ষক ও কর্মচারী দৈনিক উপস্থিতি তালিকা' : 'Staff Daily Attendance'} • {formatSafeDate(selectedDate, isBn)}
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              {formatNumber(teachers.length, language)} {isBn ? 'জন শিক্ষক ও কর্মী' : 'staff members'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">{isBn ? 'নাম ও পদবি' : 'Name & Designation'}</th>
                  <th className="py-3 px-4 text-center">{isBn ? 'হাজিরা স্ট্যাটাস' : 'Status'}</th>
                  <th className="py-3 px-4">{isBn ? 'প্রবেশ সময় (In)' : 'In Time'}</th>
                  <th className="py-3 px-4">{isBn ? 'প্রস্থান সময় (Out)' : 'Out Time'}</th>
                  <th className="py-3 px-4">{isBn ? 'মোবাইল নম্বর' : 'Phone'}</th>
                  <th className="py-3 px-4">{isBn ? 'মন্তব্য' : 'Remarks'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {teachers.map(teacher => {
                  // Master audit F1: an unmarked teacher has no entry, so
                  // no status button is highlighted — the row must not
                  // look PRESENT before anyone marks it.
                  const current: { status?: AttendanceStatus; inTime?: string; outTime?: string; note?: string } = staffAttendanceMap[teacher.id] || {};
                  const currentStatus = current.status;

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{teacher.name}</div>
                        <div className="text-[11px] text-teal-800 font-semibold">{teacher.designation || 'শিক্ষক'}</div>
                        {isRecordUnconfirmed('dailyStaffAttendance', `${selectedDate}_${teacher.id}`) && (
                          <UnconfirmedBadge isBn={isBn} />
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setStaffAttendanceMap(prev => ({
                              ...prev,
                              [teacher.id]: { ...prev[teacher.id], status: 'PRESENT' }
                            }))}
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                              currentStatus === 'PRESENT' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isBn ? 'উপস্থিত' : 'Present'}
                          </button>
                          <button
                            onClick={() => setStaffAttendanceMap(prev => ({
                              ...prev,
                              [teacher.id]: { ...prev[teacher.id], status: 'ABSENT' }
                            }))}
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                              currentStatus === 'ABSENT' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isBn ? 'অনুপস্থিত' : 'Absent'}
                          </button>
                          <button
                            onClick={() => setStaffAttendanceMap(prev => ({
                              ...prev,
                              [teacher.id]: { ...prev[teacher.id], status: 'LEAVE' }
                            }))}
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                              currentStatus === 'LEAVE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isBn ? 'ছুটি' : 'Leave'}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input 
                          type="text"
                          value={current.inTime || '08:15 AM'}
                          onChange={(e) => setStaffAttendanceMap(prev => ({
                            ...prev,
                            [teacher.id]: { ...prev[teacher.id], inTime: e.target.value }
                          }))}
                          className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input 
                          type="text"
                          value={current.outTime || '04:00 PM'}
                          onChange={(e) => setStaffAttendanceMap(prev => ({
                            ...prev,
                            [teacher.id]: { ...prev[teacher.id], outTime: e.target.value }
                          }))}
                          className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {teacher.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <input 
                          type="text"
                          value={current.note || ''}
                          placeholder={isBn ? 'মন্তব্য...' : 'Note...'}
                          onChange={(e) => setStaffAttendanceMap(prev => ({
                            ...prev,
                            [teacher.id]: { ...prev[teacher.id], note: e.target.value }
                          }))}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. MODE 3: Absentees & SMS Notification */}
      {activeMode === 'absentees' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserX className="text-rose-600" size={20} />
                <span>{isBn ? 'অনুপস্থিত শিক্ষার্থীর তালিকা ও অভিভাবক যোগাযোগ' : 'Absent Students & Guardian Alert'}</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isBn ? `${formatSafeDate(selectedDate, isBn)} তারিখে ${selectedClass} এর অনুপস্থিত তালিবুল ইলম` : `Absentees on ${selectedDate}`}
              </p>
            </div>
            <Button 
              onClick={() => setIsSmsModalOpen(true)}
              className="bg-rose-700 hover:bg-rose-800 text-white font-bold flex items-center gap-2 cursor-pointer"
            >
              <Send size={15} />
              <span>{isBn ? 'সকল অভিভাবককে SMS পাঠান' : 'Send Bulk SMS'}</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">{isBn ? 'রোল' : 'Roll'}</th>
                  <th className="py-2.5 px-3">{isBn ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                  <th className="py-2.5 px-3">{isBn ? 'পিতা / অভিভাবক' : 'Guardian'}</th>
                  <th className="py-2.5 px-3">{isBn ? 'মোবাইল নম্বর' : 'Phone'}</th>
                  <th className="py-2.5 px-3 text-center">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'দ্রুত যোগাযোগ' : 'Quick Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {absentStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-emerald-700 font-bold">
                      <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-600" />
                      <p>{isBn ? 'কোনো শিক্ষার্থী অনুপস্থিত নেই।' : 'No absentees in this class today!'}</p>
                    </td>
                  </tr>
                ) : (
                  absentStudents.map(student => {
                    const smsBody = `${isBn ? 'সম্মানিত অভিভাবক, আপনার সন্তান' : 'Respected guardian, student'} ${student.nameBn || student.name} (${isBn ? 'রোল' : 'Roll'}: ${student.roll || student.rollNumber || '১'}) ${isBn ? 'আজ মাদরাসায় অনুপস্থিত। যোগাযোগ:' : 'is absent today. Contact:'} ${schoolProfile.phone || ''}`;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{student.roll || student.rollNumber || '—'}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{student.nameBn || student.name}</td>
                        <td className="py-2.5 px-3 text-slate-800">{student.fatherNameBn || student.fatherName || '—'}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-800">{student.guardianPhone || '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            {isBn ? 'অনুপস্থিত' : 'Absent'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {student.guardianPhone && (
                              <>
                                <a 
                                  href={`tel:${student.guardianPhone}`} 
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 transition"
                                >
                                  <Phone size={12} />
                                  <span>{isBn ? 'কল' : 'Call'}</span>
                                </a>
                                <a 
                                  href={`sms:${student.guardianPhone}?body=${encodeURIComponent(smsBody)}`} 
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold border border-blue-200 transition"
                                >
                                  <MessageSquare size={12} />
                                  <span>SMS</span>
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. MODE 4: Sync to Exam Marksheet & Remarks Fine-Tuning */}
      {activeMode === 'sync_exam' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="text-indigo-600" size={20} />
                  <span>{isBn ? 'দৈনিক উপস্থিতি থেকে পরীক্ষার মার্কশিটে স্বয়ংক্রিয় গণনা ও সিঙ্ক' : 'Automated Rollup to Exam Marksheets'}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {isBn 
                    ? 'আলাদা করে ম্যানুয়াল হিসাব করার প্রয়োজন নেই! সংরক্ষিত দৈনিক হাজিরার ডেটা বিশ্লেষণ করে পরীক্ষার টার্মের মোট কার্যদিবস ও উপস্থিতি স্বয়ংক্রিয়ভাবে রেজাল্ট শিটে যুক্ত হবে।' 
                    : 'Automatically calculate and push student working days, total present, and absent counts directly to Exam result cards.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {remarksSaveStatus === 'saving' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                    <Loader2 size={13} className="animate-spin text-amber-600" />
                    <span>{isBn ? 'সংরক্ষিত হচ্ছে...' : 'Auto-saving...'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>{isBn ? 'অটো-সেভ সক্রিয়' : 'Auto-saved'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Filter and Action Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {isBn ? '১. টার্ম / পরীক্ষা নির্বাচন করুন' : '1. Select Exam Term'}
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-slate-800"
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.academicYear})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {isBn ? '২. লক্ষ্য শ্রেণি' : '2. Target Class'}
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-slate-800"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleSyncToExam}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  <Sparkles size={16} />
                  <span>{isBn ? 'দৈনিক হাজিরা থেকে অটো সিঙ্ক' : 'Auto-Sync from Daily'}</span>
                </Button>
              </div>
            </div>

            {syncStatus && (
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 size={16} />
                <span>{syncStatus}</span>
              </div>
            )}
          </div>

          {/* Detailed Exam Attendance & Remarks Editor Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award size={16} className="text-teal-700" />
                  <span>{isBn ? 'পরীক্ষার মার্কশিট হাজিরা ও শিক্ষক মন্তব্য এডিটর' : 'Exam Attendance & Remarks Editor'}</span>
                </h4>
              </div>

              <div className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200">
                {formatNumber(classStudents.length, language)} {isBn ? 'জন শিক্ষার্থী' : 'students'}
              </div>
            </div>

            {/* Master audit F10: impossible triples are warned here and
                never saved — fix the numbers and the warning clears. */}
            {Object.keys(remarksWarnings).length > 0 && (
              <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-semibold space-y-1">
                {Object.entries(remarksWarnings).map(([studentId, problem]) => {
                  const st = classStudents.find(s => s.id === studentId);
                  return (
                    <p key={studentId}>
                      {st ? `${st.nameBn || st.name} (রোল ${st.roll || st.rollNumber || '-'})` : ''}: {problem} সংরক্ষণ হয়নি — ঠিক করে আবার লিখুন।
                    </p>
                  );
                })}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 text-center w-12">{isBn ? 'ক্রমিক' : 'SL'}</th>
                    <th className="py-3 px-3 text-left w-24">{isBn ? 'রোল / আইডি' : 'Roll / ID'}</th>
                    <th className="py-3 px-3 text-left min-w-[150px]">{isBn ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                    <th className="py-3 px-3 text-center w-24">{isBn ? 'মোট কর্মদিবস' : 'Working Days'}</th>
                    <th className="py-3 px-3 text-center w-24">{isBn ? 'মোট উপস্থিতি' : 'Present'}</th>
                    <th className="py-3 px-3 text-center w-24">{isBn ? 'মোট অনুপস্থিত' : 'Absent'}</th>
                    <th className="py-3 px-3 text-center w-20">{isBn ? 'শতকরা %' : 'Rate %'}</th>
                    <th className="py-3 px-3 text-left min-w-[240px]">{isBn ? 'শিক্ষকের চারিত্রিক মন্তব্য' : 'Teacher Remark'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {classStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                        {isBn ? 'এই শ্রেণিতে কোনো শিক্ষার্থী নেই।' : 'No students in this class.'}
                      </td>
                    </tr>
                  ) : (
                    classStudents.map((student, idx) => {
                      const data = localRemarksData[student.id] || {};
                      const workingDays = Number(data.workingDays) || 0;
                      const present = Number(data.totalPresent) || 0;
                      // Master audit F10: rate is capped at 100% — an
                      // impossible triple must never print over 100%.
                      const rate = cappedAttendanceRate(present, workingDays);

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-bold">{formatNumber(idx + 1, language)}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                            {formatNumber(student.roll || student.rollNumber || student.studentId || '-', language)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{student.nameBn || student.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {student.studentId || '-'}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input 
                              type="number"
                              min="0"
                              value={data.workingDays ?? ''}
                              onChange={(e) => handleRemarkFieldChange(student.id, 'workingDays', e.target.value)}
                              placeholder="0"
                              className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input 
                              type="number"
                              min="0"
                              value={data.totalPresent ?? ''}
                              onChange={(e) => handleRemarkFieldChange(student.id, 'totalPresent', e.target.value)}
                              placeholder="0"
                              className="w-16 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-center text-xs font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input 
                              type="number"
                              min="0"
                              value={data.totalAbsent ?? ''}
                              onChange={(e) => handleRemarkFieldChange(student.id, 'totalAbsent', e.target.value)}
                              placeholder="0"
                              className="w-16 px-2 py-1 bg-white border border-rose-300 rounded-lg text-center text-xs font-bold text-rose-800 focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                              rate >= 85 ? 'bg-emerald-100 text-emerald-800' : (rate >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')
                            }`}>
                              {formatNumber(rate, language)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <input 
                                type="text"
                                value={data.remark ?? ''}
                                onChange={(e) => handleRemarkFieldChange(student.id, 'remark', e.target.value)}
                                placeholder={isBn ? 'চারিত্রিক ও আচরণিক মন্তব্য...' : 'Behavioral remark...'}
                                className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                              <div className="flex items-center gap-1 flex-wrap">
                                {[
                                  isBn ? 'খুব ভালো ও নিয়মিত' : 'Excellent',
                                  isBn ? 'সন্তোষজনক' : 'Good',
                                  isBn ? 'উপস্থিতি বৃদ্ধি প্রয়োজন' : 'Needs Work'
                                ].map(preset => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleApplyPresetRemark(student.id, preset)}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-teal-100 hover:text-teal-800 text-slate-600 font-semibold transition cursor-pointer"
                                  >
                                    +{preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. Absentee SMS Composer Modal */}
      {isSmsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isBn ? 'অনুপস্থিত শিক্ষার্থীর অভিভাবক SMS নোটিফিকেশন' : 'Absentee Guardian SMS Alert'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {formatSafeDate(selectedDate, isBn)} • {selectedClass}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsSmsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Target Recipients Summary */}
            <div className="bg-rose-50/80 p-3.5 rounded-2xl border border-rose-200/80 text-xs text-rose-950 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span>{isBn ? 'অনুপস্থিত মোট শিক্ষার্থী:' : 'Total Absentees:'}</span>
                <span className="text-rose-700 font-mono text-sm">{formatNumber(absentStudents.length, language)} {isBn ? 'জন' : ''}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>{isBn ? 'সচল অভিভাবক মোবাইল নম্বর:' : 'Valid Phone Numbers:'}</span>
                <span className="font-mono font-bold text-teal-800">
                  {formatNumber(absentStudents.filter(s => s.guardianPhone).length, language)} {isBn ? 'টি' : ''}
                </span>
              </div>
            </div>

            {/* SMS Message Template Preview */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {isBn ? 'প্রস্তুতকৃত বাংলা SMS বার্তা:' : 'Prepared SMS Message:'}
              </label>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 font-sans leading-relaxed">
                {isBn 
                  ? `সম্মানিত অভিভাবক, আপনার সন্তান আজ (${formatSafeDate(selectedDate, true)}) মাদরাসায় উপস্থিত হয়নি। জরুরি প্রয়োজনে মাদরাসা অফিসে যোগাযোগ করার জন্য অনুরোধ করা হলো। - ${schoolProfile.nameBn || schoolProfile.name || 'মাদরাসা কর্তৃপক্ষ'}`
                  : `Dear Guardian, your student is absent today (${selectedDate}). Please contact the madrasah office for any queries. - ${schoolProfile.name || 'Administration'}`}
              </div>
            </div>

            {/* Action Feedback Notification */}
            {smsCopiedNotice && (
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{smsCopiedNotice}</span>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <Button
                type="button"
                onClick={() => {
                  const phones = absentStudents.map(s => s.guardianPhone).filter(Boolean).join(',');
                  if (phones) {
                    navigator.clipboard.writeText(phones);
                    setSmsCopiedNotice(isBn ? 'সকল মোবাইল নম্বর ক্লিপবোর্ডে কপি হয়েছে!' : 'Copied all numbers to clipboard!');
                    setTimeout(() => setSmsCopiedNotice(null), 3000);
                  } else {
                    setSmsCopiedNotice(isBn ? 'কোনো নম্বর পাওয়া যায়নি।' : 'No phone numbers found.');
                    setTimeout(() => setSmsCopiedNotice(null), 3000);
                  }
                }}
                className="w-full sm:w-1/2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 text-xs flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
              >
                <Copy size={14} />
                <span>{isBn ? 'নম্বরসমূহ কপি করুন' : 'Copy All Numbers'}</span>
              </Button>

              {(() => {
                const phones = absentStudents.map(s => s.guardianPhone).filter(Boolean).join(',');
                const defaultMsg = isBn 
                  ? `সম্মানিত অভিভাবক, আপনার সন্তান আজ (${formatSafeDate(selectedDate, true)}) মাদরাসায় অনুপস্থিত। - ${schoolProfile.nameBn || schoolProfile.name || 'মাদরাসা'}`
                  : `Dear Guardian, student absent today (${selectedDate}). - ${schoolProfile.name || 'Madrasah'}`;

                return (
                  <a
                    href={`sms:${phones}?body=${encodeURIComponent(defaultMsg)}`}
                    className="w-full sm:w-1/2 bg-rose-700 hover:bg-rose-800 text-white font-bold py-2.5 text-xs flex items-center justify-center gap-1.5 rounded-xl transition cursor-pointer text-center"
                  >
                    <Send size={14} />
                    <span>{isBn ? 'SMS অ্যাপে খুলুন' : 'Open in SMS App'}</span>
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
