import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme, ACCENT_THEMES } from '../context/ThemeContext';
import { calculateTotalGPA, generateVoucherNo } from '../services/utils';
import { normalizeRoleKey, bestDesignationRole } from '../services/roleResolution';
import { resolveGuardianChildren } from '../services/guardianScope';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { ServerDataGate } from './ui/ServerDataGate';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { dailyAttendanceService, filterStudentRecordsByDateAndClass, calculateStudentAttendanceForExamFromRecords, getStudentMonthlySummaryFromRecords, DailyStudentAttendanceRecord, AttendanceStatus } from '../services/dailyAttendanceService';
import { ATTENDANCE_CLOUD_FAILURE_MESSAGE, MARKS_CLOUD_FAILURE_MESSAGE, LEAVE_CLOUD_FAILURE_MESSAGE, STAFF_CLOUD_FAILURE_MESSAGE, STUDENTS_CLOUD_FAILURE_MESSAGE, STUDENT_DELETE_CLOUD_FAILURE_MESSAGE, feeCloudFailureMessage, RECEIPT_LOCAL_ONLY_NOTE, RETRY_LABEL } from '../services/cloudConfirm';
import { STAFF_LEAVE_TYPE_OPTIONS, computeLeaveDays, buildStaffLeaveRequest, sanitizeProfileEdit } from '../services/staffSelfService';
import { DAYS_OF_WEEK } from '../services/academicScheduleService';
import { DayOfWeek } from '../types/academic';
import { calculateClassDuesSummary, calculateSingleStudentDue, getDueReminderMessage, calculateFeeAging, StudentDueProfile, FeeAging } from '../services/studentDuesService';
import { Student, MarkRecord, Exam, Subject, FinanceTransaction, PaymentMethod, StaffLeaveRecord, TrashItem } from '../types';
import {
  Home,
  LayoutGrid,
  CheckSquare,
  PenTool,
  Users,
  Wallet,
  Receipt,
  FileSpreadsheet,
  Bell,
  ChevronRight,
  Calendar,
  CalendarDays,
  Clock,
  MapPin,
  Award,
  CreditCard,
  LogOut,
  CheckCircle2,
  FileText,
  GraduationCap,
  ArrowLeft,
  X,
  Phone,
  Palette,
  Printer,
  Search,
  MessageCircle,
  Copy,
  Check,
  Send,
  Save,
  DollarSign,
  User,
  TrendingUp,
  ClipboardList,
  Sparkles,
  Sun,
  Moon,
  Lock,
  BarChart3,
  Globe,
  Settings
} from 'lucide-react';

/**
 * StaffMobileApp — Tutor App-style premium mobile experience for staff roles
 * (teacher / accountant-cashier / office staff / guardian).
 *
 * Design tokens copied from the Tutor App:
 *  page #f4f6fb · card #ffffff · ink #1e2433 · line #e8ecf4
 *  accent violet #8b5cf6 → #7c3aed · soft violet #ede9fe
 *  success #10b981 · warning #f59e0b · danger #ef4444 · info #3b82f6
 *  dark: page #0e1220 · card #161c2e
 *
 * Data logic (role detection, class-teacher scoping, dues, attendance,
 * marks) is ported from the previous MobileRoleAppView so behaviour and
 * saved data stay identical — only the presentation is new.
 */

interface StaffMobileAppProps {
  onLogout?: () => void;
  renderModuleContent?: (moduleKey: string) => React.ReactNode;
}

const cardCls = 'bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/5 rounded-[24px] shadow-[0_2px_12px_rgba(30,36,51,0.05)]';
const softBg = 'bg-[#f4f6fb] dark:bg-white/5';
// ---- Attendance page (Tutor pattern) helpers ----
// Tutor card shell: rounded-2xl white card (LDSDM's cardCls is 24px).
const attCardCls = 'bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/5 rounded-2xl shadow-sm';
// Tutor avatar tints (pastel bg + dark text, hashed by id).
const ATT_AVATAR_TINTS = [
  { bg: '#dcfce7', color: '#15803d' },
  { bg: '#fee2e2', color: '#b91c1c' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#ffedd5', color: '#c2410c' },
] as const;
const attAvatarTint = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ATT_AVATAR_TINTS[h % ATT_AVATAR_TINTS.length];
};
const attInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Tutor late-picker drum wheels: hours 0-3 x minutes 0-59 (total 0-239).
const WHEEL_ITEM_H = 46;
const WHEEL_ROWS = 4;
const WHEEL_VIEW_H = WHEEL_ITEM_H * WHEEL_ROWS;
const WHEEL_PAD = (WHEEL_VIEW_H - WHEEL_ITEM_H) / 2;
const LATE_HOURS: number[] = [0, 1, 2, 3];
const LATE_MINUTE_VALUES: number[] = Array.from({ length: 60 }, (_, i) => i);
const LATE_MAX_TOTAL = 239;
const WHEEL_FADE = 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)';
/** One scrollable drum column with scroll-snap (ported from Tutor's Attendance page). */
function WheelColumn(props: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  ariaLabel: string;
}) {
  const { values, value, onChange, format, ariaLabel } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const settleRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = values.indexOf(value);
    if (idx < 0) return;
    const target = idx * WHEEL_ITEM_H;
    if (!mountedRef.current) {
      mountedRef.current = true;
      el.scrollTop = target;
      return;
    }
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTo({ top: target, behavior: 'smooth' });
    }
  }, [value, values]);
  useEffect(() => () => {
    if (settleRef.current) window.clearTimeout(settleRef.current);
  }, []);
  const handleScroll = () => {
    if (settleRef.current) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_H)));
      const v = values[idx];
      if (v !== value) onChange(v);
    }, 90);
  };
  return (
    <div
      ref={scrollRef}
      role="listbox"
      aria-label={ariaLabel}
      onScroll={handleScroll}
      className="late-wheel-scroll flex-1 overflow-y-auto"
      style={{
        height: WHEEL_VIEW_H,
        scrollSnapType: 'y mandatory',
        paddingTop: WHEEL_PAD,
        paddingBottom: WHEEL_PAD,
        scrollbarWidth: 'none',
      }}
    >
      {values.map(v => {
        const selected = v === value;
        return (
          <button
            key={v}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(v)}
            className="w-full flex items-center justify-center"
            style={{
              height: WHEEL_ITEM_H,
              scrollSnapAlign: 'center',
              background: 'transparent',
              fontSize: selected ? 24 : 18,
              fontWeight: selected ? 800 : 500,
              color: selected ? '#d97706' : '#8a93a8',
              transition: 'font-size 120ms ease, color 120ms ease',
            }}
          >
            {format(v)}
          </button>
        );
      })}
    </div>
  );
}


// Short Bengali month names for report bars ("2026-09" -> "সেপ ২০২৬" via bnMonth below).
const BN_MONTH_SHORT = ['জান', 'ফেব', 'মার', 'এপ্র', 'মে', 'জুন', 'জুল', 'আগ', 'সেপ', 'অক্ট', 'নভে', 'ডিস'];
const bnMonthLabel = (yyyyMm: string): string => {
  const y = yyyyMm.slice(0, 4);
  const m = Number(yyyyMm.slice(5, 7));
  if (!y || !m || m < 1 || m > 12) return yyyyMm;
  return `${BN_MONTH_SHORT[m - 1]} ${y}`;
};

export const StaffMobileApp: React.FC<StaffMobileAppProps> = ({ onLogout, renderModuleContent }) => {
  const {
    authUser,
    currentMember,
    currentRole,
    currentUser,
    effectiveRoles,
    schoolProfile,
    students = [],
    classes = [],
    subjects = [],
    marks = [],
    exams = [],
    transactions = [],
    feeStructures = [],
    notices = [],
    classRoutines = [],
    calendarEvents = [],
    teachers = [],
    dailyStudentAttendance = [],
    addTransaction,
    confirmAttendanceCloudSync,
    confirmFeeCloudSync,
    confirmMarksCloudSync,
    confirmLeavesCloudSync,
    confirmStaffCloudSync,
    confirmStudentsCloudSync,
    confirmStudentDeleteCloudSync,
    updateTeacher,
    staffLeaves = [],
    setStaffLeaves,
    updateStudent,
    deleteStudent,
    bulkUpdateMarks,
    language,
    setLanguage,
    hasPermission,
    logoutAdmin,
    setActiveTab,
  } = useApp();

  const { accentTheme, setAccentTheme, darkMode, setDarkMode, toggleDarkMode } = useTheme();
  const isEn = language === 'en';

  // 1. Determine the mobile home for this person.
  //
  // PRECEDENCE (the accountant→teacher fix; see services/roleResolution.ts):
  //   (a) the logged-in ACCOUNT's own stored role is authoritative —
  //       the old code read `currentMember?.roleId || currentUser?.role`,
  //       so a stale 'role_teacher' member document (or a CustomRole
  //       document resolved from it) shadowed the account and routed
  //       an accountant to the teacher home;
  //   (b) then the member document's roleId;
  //   (c) then the CustomRole name/displayName signals (custom roles
  //       with generated ids);
  //   (d) then the role derived from the LINKED staff record's
  //       designation — across ALL matching records, so a leftover
  //       plain-teacher duplicate cannot beat the record whose
  //       designation says "Accountant";
  //   (e) then the permission fallback (finance-entry without
  //       marks-entry means accounts work);
  //   (f) default 'teacher'.
  // 'teacher' is the weakest stamp at every step (it was the historical
  // default written by older code), so a non-teacher signal found at a
  // later step still beats a teacher stamp found earlier.
  type MobileHome = 'teacher' | 'cashier' | 'parent' | 'staff' | 'principal';
  const homeForRoleKey = (raw?: string | null): MobileHome | null => {
    const key = normalizeRoleKey(raw);
    if (key === 'accountant') return 'cashier';
    if (key === 'teacher') return 'teacher';
    if (key === 'guardian') return 'parent';
    if (key === 'staff') return 'staff';
    // Phase 1b: principal / super_admin get their own mobile home.
    if (key === 'principal' || key === 'super_admin') return 'principal';
    return null;
  };

  const primaryHome = useMemo<MobileHome>(() => {
    // (a) account role, then (b) member roleId — non-teacher wins.
    const accountHome = homeForRoleKey(currentUser?.role);
    if (accountHome && accountHome !== 'teacher') return accountHome;
    const memberHome = homeForRoleKey(currentMember?.roleId);
    if (memberHome && memberHome !== 'teacher') return memberHome;

    // (c) CustomRole name/displayName signals (English + Bangla).
    const hay = `${String(currentRole?.name || '').toLowerCase()} ${String(currentRole?.displayName || '').toLowerCase()}`;
    if (hay.includes('account') || hay.includes('cashier') || hay.includes('হিসাব') || hay.includes('ক্যাশ')) return 'cashier';
    if (hay.includes('guardian') || hay.includes('parent') || hay.includes('অভিভাবক')) return 'parent';
    if (hay.includes('librarian') || hay.includes('গ্রন্থাগার')) return 'staff';

    // (d) linked staff records' designations — best (non-teacher) wins.
    const email = (currentUser?.email || authUser?.email || '').toLowerCase();
    const phone = currentUser?.phone || currentMember?.phone || '';
    const linked = teachers.filter(t =>
      (currentUser?.id && (t.id === currentUser.id || t.userId === currentUser.id)) ||
      (email !== '' && t.email && t.email.toLowerCase() === email) ||
      (phone !== '' && t.phone && t.phone === phone)
    );
    if (linked.length > 0) {
      const derivedHome = homeForRoleKey(bestDesignationRole(linked));
      if (derivedHome && derivedHome !== 'teacher') return derivedHome;
    }

    // Remaining teacher signals from the old combined check.
    if (hay.includes('teacher') || hay.includes('শিক্ষক') || hay.includes('মৌলভী') || hay.includes('মাওলানা')) return 'teacher';
    if (hay.includes('staff') || hay.includes('office') || hay.includes('অফিস')) return 'staff';
    if (accountHome) return accountHome; // the account's teacher stamp
    if (memberHome) return memberHome;

    // (e) permission fallback.
    try {
      if (typeof hasPermission === 'function') {
        const canFee = !!(hasPermission('fees.create' as any) || hasPermission('finance.create' as any) || hasPermission('payments.create' as any));
        const canMarks = !!hasPermission('marks.create' as any);
        const canAttend = !!hasPermission('attendance.create' as any);
        if (canFee && !canMarks && !canAttend) return 'cashier';
      }
    } catch { /* keep default below */ }
    return 'teacher'; // (f) Default role for standard instructors
  }, [currentMember, currentUser, currentRole, hasPermission, teachers, authUser]);

  // Multi-role: every effective role that has a mobile home is offered
  // in the switcher; the primary role's home comes first and is the
  // default. Single-role users get exactly one home → no switcher,
  // UI unchanged for them.
  const availableHomes = useMemo<MobileHome[]>(() => {
    const homes: MobileHome[] = [];
    const add = (h: MobileHome | null) => {
      if (h && !homes.includes(h)) homes.push(h);
    };
    add(primaryHome);
    (effectiveRoles || []).forEach(k => add(homeForRoleKey(k)));
    return homes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryHome, effectiveRoles]);

  const [homeOverride, setHomeOverride] = useState<MobileHome | null>(null);
  const userRole: MobileHome =
    homeOverride && availableHomes.includes(homeOverride) ? homeOverride : primaryHome;

  const [activeBottomNav, setActiveBottomNav] = useState<string>('home');
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeSubModule, setActiveSubModule] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  // Step 4 (25 Oct 2026): staff leave request screen (NOT self-attendance —
  // staff attendance stays admin-only). Staff-submitted requests are
  // always PENDING; approval happens on desktop.
  const [showLeave, setShowLeave] = useState(false);
  const [leaveType, setLeaveType] = useState<StaffLeaveRecord['leaveType']>('CASUAL');
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveEnd, setLeaveEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveFailure, setLeaveFailure] = useState<string | null>(null);
  const [leaveSuccess, setLeaveSuccess] = useState<string | null>(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  // Step 4: own profile edit — display fields only (name, nameBn,
  // employeeCode). Credential/designation/class fields stay admin-only.
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNameBn, setEditNameBn] = useState('');
  const [editEmployeeCode, setEditEmployeeCode] = useState('');
  const [profileFailure, setProfileFailure] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  // Tutor-style accent + mode picker in the shell top bar (all roles).
  // Popup stays open on selection (like Tutor) — only an outside tap closes it.
  const [showThemePicker, setShowThemePicker] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onOutsideTap = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) setShowThemePicker(false);
    };
    document.addEventListener('mousedown', onOutsideTap);
    return () => document.removeEventListener('mousedown', onOutsideTap);
  }, []);
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  // Truthful-save failure notices (25 Oct 2026): set only when the
  // awaited cloud confirmation fails. Local data is never dropped — the
  // banner stays until a retry confirms the write.
  const [attendanceCloudFailure, setAttendanceCloudFailure] = useState<string | null>(null);
  const [feeCloudFailure, setFeeCloudFailure] = useState<string | null>(null);
  const [marksCloudFailure, setMarksCloudFailure] = useState<string | null>(null);

  // Helper for Bengali number formatting
  const toBn = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    const banglaNums: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
      '.': '.'
    };
    return str.split('').map(c => banglaNums[c] || c).join('');
  };

  // 2. Class Scope Isolation for Teacher — only the classes they are assigned to
  // 24 Oct 2026 visibility fix: NO silent fallback to the first class.
  // A teacher whose record carries no assignedClasses used to be handed
  // classes[0] (and the switcher only renders for >1 class, so they
  // could not even switch away) — their saves then landed under a class
  // no class view queries for them. No assigned class now means an
  // honest empty state in the attendance module (see below), never a
  // wrong class's roster.
  const teacherClasses = useMemo(() => {
    const assigned = currentMember?.assignedClasses || currentUser?.assignedClasses || [];
    return assigned.length > 0 ? assigned : [];
  }, [currentMember, currentUser]);

  const [selectedClass, setSelectedClass] = useState<string>(() => {
    return teacherClasses[0] || '';
  });

  useEffect(() => {
    if (teacherClasses.length > 0 && !teacherClasses.includes(selectedClass)) {
      setSelectedClass(teacherClasses[0]);
    } else if (teacherClasses.length === 0 && selectedClass !== '') {
      setSelectedClass('');
    }
  }, [teacherClasses, selectedClass]);

  // Students isolated to the selected assigned class (teacher) / all active (others)
  const classStudents = useMemo(() => {
    if (userRole === 'teacher') {
      return students.filter(s => s.status === 'Active' && !s.isFormer && s.classLevel === selectedClass);
    }
    return students.filter(s => s.status === 'Active' && !s.isFormer);
  }, [students, selectedClass, userRole]);

  // Dues Summary for the teacher's class
  const classDuesSummary = useMemo(() => {
    return calculateClassDuesSummary(classStudents, feeStructures, transactions);
  }, [classStudents, feeStructures, transactions]);

  // All-students dues (accountant)
  const allDuesSummary = useMemo(() => {
    if (userRole === 'teacher') return classDuesSummary;
    const active = students.filter(s => s.status === 'Active' && !s.isFormer);
    return calculateClassDuesSummary(active, feeStructures, transactions);
  }, [userRole, classDuesSummary, students, feeStructures, transactions]);

  // Guardian scope: the signed-in guardian's OWN child(ren), resolved
  // by the single linkage in services/guardianScope.ts. Null for
  // sessions without the guardian role (unscoped — staff aggregates
  // above stay exactly as they are for those homes). An unlinked
  // guardian resolves to an EMPTY list, never a fallback student.
  const guardianChildren = useMemo(() => {
    if (!(effectiveRoles || []).includes('guardian')) return null;
    return resolveGuardianChildren(currentUser, students, {
      phones: [currentMember?.phone],
      emails: [currentMember?.email, authUser?.email]
    });
  }, [effectiveRoles, currentUser, currentMember, authUser, students]);

  // Recorded-only attendance aggregate over the guardian's children
  // (present / recorded days — no records anywhere means rate 0 with
  // recorded 0, which the stats render as "no records", not a rate).
  const guardianAttendance = useMemo(() => {
    let recorded = 0;
    let present = 0;
    (guardianChildren || []).forEach(child => {
      const s = calculateStudentAttendanceForExamFromRecords(dailyStudentAttendance, child.id);
      recorded += s.workingDays;
      present += s.totalPresent;
    });
    return { recorded, present, rate: recorded > 0 ? Math.round((present / recorded) * 100) : 0 };
  }, [guardianChildren, dailyStudentAttendance]);

  // This month's dues summed over the guardian's children only (the
  // parent home previously showed the WHOLE institution's dues here).
  const guardianDuesTotal = useMemo(() => {
    if (!guardianChildren) return 0;
    return guardianChildren.reduce(
      (sum, child) => sum + calculateSingleStudentDue(child, feeStructures, transactions).dueThisMonth,
      0
    );
  }, [guardianChildren, feeStructures, transactions]);

  // Portal tab hint for the guardian self-service portal (consumed by
  // GuardianPortal's initial tab — see its sessionStorage bridge).
  const setPortalTabHint = (tab: 'results' | 'attendance' | 'fees') => {
    try { sessionStorage.setItem('ldsdm_guardian_portal_tab', tab); } catch { /* ignore */ }
  };

  // 3. Daily Attendance state
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [studentAttendanceMap, setStudentAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  // Phase 3: late minutes per student (Tutor late-minutes picker).
  // Persisted on the record as the additive optional lateMinutes field;
  // old records simply lack it.
  const [lateMinutesMap, setLateMinutesMap] = useState<Record<string, number>>({});
  const [latePicker, setLatePicker] = useState<{ studentId: string; hours: number; minutes: number } | null>(null);
  // Phase 3: roll-call / monthly-sheet tabs + sheet month.
  const [attTab, setAttTab] = useState<'rollcall' | 'sheet'>('rollcall');
  const [sheetMonth, setSheetMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Step 3: the form map reads the SHARED context array (same data as the
  // singleton at init time). Deps deliberately stay [attendanceDate,
  // selectedClass]: this is editor state — a cloud arrival mid-edit must
  // not clobber the teacher's unsaved taps. The display memos below
  // carry the reactivity instead.
  useEffect(() => {
    const savedRecords = filterStudentRecordsByDateAndClass(dailyStudentAttendance, attendanceDate, selectedClass);
    const map: Record<string, AttendanceStatus> = {};
    const mins: Record<string, number> = {};
    savedRecords.forEach(r => {
      map[r.studentId] = r.status;
      if (r.status === 'LATE' && r.lateMinutes && r.lateMinutes > 0) mins[r.studentId] = r.lateMinutes;
    });
    setStudentAttendanceMap(map);
    setLateMinutesMap(mins);
  }, [attendanceDate, selectedClass]);

  // Phase 3 — HOLIDAY-OFF (user's rule): a calendar HOLIDAY/VACATION
  // event covering the selected date (for this class, when the event
  // names classes) means no roll-call that day. If records already
  // exist for the date+class (holiday declared after taking), the
  // roll-call still shows so saved data is never orphaned.
  const holidayForDate = (dateStr: string, classLevel: string) => {
    return (calendarEvents || []).find(ev => {
      const isHol = ev.isHoliday || ev.type === 'HOLIDAY' || ev.type === 'VACATION';
      if (!isHol) return false;
      if (dateStr < ev.startDate || dateStr > ev.endDate) return false;
      if (ev.applicableClasses && ev.applicableClasses.length > 0 && !ev.applicableClasses.includes(classLevel)) return false;
      return true;
    });
  };
  const attendanceHoliday = holidayForDate(attendanceDate, selectedClass);
  const attendanceSavedCount = filterStudentRecordsByDateAndClass(dailyStudentAttendance, attendanceDate, selectedClass).length;
  const attendanceDayOff = !!attendanceHoliday && attendanceSavedCount === 0;

  // Phase 3: monthly-sheet records for the selected class + month.
  // Step 3: reads the shared context array (reactive to cloud arrivals);
  // sheetByStudent derives from this memo, so it inherits reactivity.
  const sheetRecords = useMemo(() => {
    return dailyStudentAttendance.filter(
      r => r.classLevel === selectedClass && r.date.startsWith(sheetMonth)
    );
  }, [sheetMonth, selectedClass, studentAttendanceMap, dailyStudentAttendance]);

  // Phase 3: sheet calendar — one entry per day of the month with its
  // marks. Friday = weekly holiday (academicScheduleService labels
  // Friday 'সাপ্তাহিক ছুটি'); calendar HOLIDAY/VACATION days are
  // marked separately. No schoolProfile weekly-holiday setting exists,
  // so Fridays are display-marked only — roll-call is NOT blocked on
  // Fridays (only calendar events block entry).
  const [sheetView, setSheetView] = useState<'cards' | 'grid'>('cards');
  const sheetDays = useMemo(() => {
    const [y, m] = sheetMonth.split('-').map(Number);
    if (!y || !m) return [] as { day: number; dateStr: string; isFriday: boolean; holiday: string | null }[];
    const daysInMonth = new Date(y, m, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${sheetMonth}-${String(day).padStart(2, '0')}`;
      const isFriday = new Date(y, m - 1, day).getDay() === 5;
      const hol = holidayForDate(dateStr, selectedClass);
      return { day, dateStr, isFriday, holiday: hol ? (hol.titleBn || hol.title) : null };
    });
  }, [sheetMonth, selectedClass, calendarEvents]);
  const sheetByStudent = useMemo(() => {
    const map = new Map<string, Map<string, DailyStudentAttendanceRecord>>();
    sheetRecords.forEach(r => {
      if (!map.has(r.studentId)) map.set(r.studentId, new Map());
      map.get(r.studentId)!.set(r.date, r);
    });
    return map;
  }, [sheetRecords]);

  const attendanceStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    const total = classStudents.length;

    classStudents.forEach(st => {
      const status = studentAttendanceMap[st.id] || studentAttendanceMap[st.studentId || ''];
      if (status === 'PRESENT') present++;
      else if (status === 'ABSENT') absent++;
      else if (status === 'LATE') late++;
      else if (status === 'LEAVE') leave++;
    });

    const attended = present + late;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
    const takenCount = present + absent + late + leave;

    return { total, present, absent, late, leave, attended, rate, takenCount, unmarked: total - takenCount };
  }, [classStudents, studentAttendanceMap]);

  const handleMarkAllPresent = () => {
    const nextMap: Record<string, AttendanceStatus> = { ...studentAttendanceMap };
    classStudents.forEach(st => {
      nextMap[st.id] = 'PRESENT';
    });
    setStudentAttendanceMap(nextMap);
    setLateMinutesMap({});
  };

  // Phase 3: Tutor ALL ABSENT + Reset (clears the working selection
  // back to unmarked; the existing save still defaults unmarked to
  // PRESENT, exactly as before — Reset alone writes nothing).
  const handleMarkAllAbsent = () => {
    const nextMap: Record<string, AttendanceStatus> = { ...studentAttendanceMap };
    classStudents.forEach(st => {
      nextMap[st.id] = 'ABSENT';
    });
    setStudentAttendanceMap(nextMap);
    setLateMinutesMap({});
  };

  const handleResetAttendance = () => {
    setStudentAttendanceMap({});
    setLateMinutesMap({});
  };

  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStudentAttendanceMap(prev => ({
      ...prev,
      [studentId]: status
    }));
    if (status !== 'LATE') {
      setLateMinutesMap(prev => {
        if (!(studentId in prev)) return prev;
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  // Phase 3: tapping LATE opens the hour/minute picker instead of
  // stamping LATE immediately; confirming stamps LATE + minutes.
  const handleLatePress = (studentId: string) => {
    // Tutor default: 10 minutes when no value saved yet; legacy values
    // above the wheel range clamp to 239 (3h59m), like Tutor's picker.
    const saved = Math.min(LATE_MAX_TOTAL, Math.max(0, lateMinutesMap[studentId] || 0));
    const total = saved > 0 ? saved : 10;
    setLatePicker({ studentId, hours: Math.floor(total / 60), minutes: total % 60 });
  };

  const handleLateConfirm = () => {
    if (!latePicker) return;
    const total = latePicker.hours * 60 + latePicker.minutes;
    setStudentAttendanceMap(prev => ({ ...prev, [latePicker.studentId]: 'LATE' }));
    setLateMinutesMap(prev => {
      if (total <= 0) {
        if (!(latePicker.studentId in prev)) return prev;
        const next = { ...prev };
        delete next[latePicker.studentId];
        return next;
      }
      return { ...prev, [latePicker.studentId]: total };
    });
    setLatePicker(null);
  };

  // Late picker open -> lock body scroll (Tutor ModalShell behavior).
  useEffect(() => {
    if (!latePicker) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [latePicker]);

  // Truthful save (25 Oct 2026): the success notice fires ONLY after the
  // awaited cloud confirmation. On failure the records stay in the local
  // service store (never dropped) and an honest failure banner with a
  // retry action is shown instead of a false success.
  const handleSaveAttendance = async () => {
    const records: DailyStudentAttendanceRecord[] = classStudents.map(st => {
      const status = studentAttendanceMap[st.id] || 'PRESENT';
      const mins = status === 'LATE' ? (lateMinutesMap[st.id] || 0) : 0;
      return {
        id: `${attendanceDate}_${st.id}`,
        date: attendanceDate,
        studentId: st.id,
        studentName: st.nameBn || st.name,
        roll: st.roll || st.rollNumber || '',
        classLevel: st.classLevel,
        status,
        ...(mins > 0 ? { lateMinutes: mins } : {}),
        updatedAt: new Date().toISOString()
      };
    });

    dailyAttendanceService.batchSaveStudentAttendance(records);
    const result = await confirmAttendanceCloudSync();
    if (result.success) {
      setAttendanceCloudFailure(null);
      setSaveSuccessNotice('✓ হাজিরা সফলভাবে সংরক্ষিত হয়েছে!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } else {
      setAttendanceCloudFailure(result.message || ATTENDANCE_CLOUD_FAILURE_MESSAGE);
    }
  };

  // Retry re-confirms the still-local records (no re-save needed).
  const retryAttendanceCloudSync = async () => {
    const result = await confirmAttendanceCloudSync();
    if (result.success) {
      setAttendanceCloudFailure(null);
      setSaveSuccessNotice('✓ হাজিরা সফলভাবে সংরক্ষিত হয়েছে!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } else {
      setAttendanceCloudFailure(result.message || ATTENDANCE_CLOUD_FAILURE_MESSAGE);
    }
  };

  // 4. Marks Entry state (teacher)
  const [selectedExamId, setSelectedExamId] = useState<string>(() => exams[0]?.id || '');
  const classSubjects = useMemo(() => {
    return subjects.filter(sub => sub.classLevel === selectedClass || sub.classId === selectedClass);
  }, [subjects, selectedClass]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => classSubjects[0]?.id || '');

  useEffect(() => {
    if (classSubjects.length > 0 && !classSubjects.some(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId(classSubjects[0].id);
    }
  }, [classSubjects, selectedSubjectId]);

  const [marksInputMap, setMarksInputMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedExamId || !selectedSubjectId) return;
    const initialMap: Record<string, string> = {};
    classStudents.forEach(st => {
      const existing = marks.find(m => m.studentId === st.id && m.subjectId === selectedSubjectId && m.examId === selectedExamId);
      if (existing) {
        initialMap[st.id] = String(existing.obtained ?? (existing as any).marksObtained ?? '');
      }
    });
    setMarksInputMap(initialMap);
  }, [selectedExamId, selectedSubjectId, classStudents, marks]);

  const handleSaveMarks = async () => {
    if (!canEnterMarks) return; // Permission gate: admin has not enabled entry
    if (!selectedExamId || !selectedSubjectId) return;
    const markRecordsToUpdate: (Omit<MarkRecord, 'id'> & { id?: string })[] = [];

    classStudents.forEach(st => {
      const val = marksInputMap[st.id];
      if (val !== undefined && val !== '') {
        const numVal = Math.min(100, Math.max(0, Number(val) || 0));
        const existing = marks.find(m => m.studentId === st.id && m.subjectId === selectedSubjectId && m.examId === selectedExamId);
        markRecordsToUpdate.push({
          id: existing?.id,
          studentId: st.id,
          subjectId: selectedSubjectId,
          examId: selectedExamId,
          obtained: numVal,
          total: 100,
          grade: numVal >= 80 ? 'A+' : numVal >= 70 ? 'A' : numVal >= 60 ? 'A-' : numVal >= 50 ? 'B' : numVal >= 40 ? 'C' : numVal >= 33 ? 'D' : 'F',
          gradePoint: numVal >= 80 ? 5 : numVal >= 70 ? 4 : numVal >= 60 ? 3.5 : numVal >= 50 ? 3 : numVal >= 40 ? 2 : numVal >= 33 ? 1 : 0
        });
      }
    });

    if (markRecordsToUpdate.length > 0) {
      // Truthful save (Step 2): success only after the awaited cloud
      // confirmation; on failure the marks stay local and an honest
      // failure banner with a retry action is shown instead.
      const nextMarks = bulkUpdateMarks(markRecordsToUpdate);
      const result = await confirmMarksCloudSync(nextMarks);
      if (result.success) {
        setMarksCloudFailure(null);
        setSaveSuccessNotice('✓ নম্বর সফলভাবে সংরক্ষিত হয়েছে!');
        setTimeout(() => setSaveSuccessNotice(null), 3000);
      } else {
        setMarksCloudFailure(result.message || MARKS_CLOUD_FAILURE_MESSAGE);
      }
    }
  };

  // Retry re-confirms the still-local marks (no re-save needed).
  const retryMarksCloudSync = async () => {
    const result = await confirmMarksCloudSync();
    if (result.success) {
      setMarksCloudFailure(null);
      setSaveSuccessNotice('✓ নম্বর সফলভাবে সংরক্ষিত হয়েছে!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } else {
      setMarksCloudFailure(result.message || MARKS_CLOUD_FAILURE_MESSAGE);
    }
  };

  // 5. Greeting helper
  const todayGreeting = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let greet = 'শুভ দিন';
    if (hour < 12) greet = 'শুভ সকাল';
    else if (hour < 16) greet = 'শুভ দুপুর';
    else if (hour < 19) greet = 'শুভ বিকেল';
    else greet = 'শুভ রাত্রি';

    const dayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const monthNames = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

    const day = dayNames[now.getDay()];
    const dateNum = toBn(now.getDate());
    const month = monthNames[now.getMonth()];
    const year = toBn(now.getFullYear());

    return { greeting: greet, fullDateText: `${day}, ${dateNum} ${month} ${year}` };
  }, [language]);

  // Cashier figures
  const cashierFigures = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todays = transactions.filter(t => t.type === 'INCOME' && (t.date?.startsWith(todayStr)));
    const todayIncome = todays.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const recent = [...transactions]
      .filter(t => t.type === 'INCOME')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 5);
    return { todayIncome, todayReceipts: todays.length, recent };
  }, [transactions]);

  // 6. Role KPI stats
  const roleStats = useMemo(() => {
    if (userRole === 'teacher') {
      return {
        stat1Value: toBn(teacherClasses.length) + 'টি', stat1Label: 'আমার ক্লাস', stat1Icon: GraduationCap, stat1Cls: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300',
        stat2Value: toBn(classStudents.length) + ' জন', stat2Label: 'শ্রেণির শিক্ষার্থী', stat2Icon: Users, stat2Cls: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300',
        stat3Value: '৳' + toBn(classDuesSummary.totalDue.toLocaleString()), stat3Label: 'শ্রেণির বকেয়া', stat3Icon: Wallet, stat3Cls: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300',
        nextTaskTime: 'আজকের কাজ',
      };
    } else if (userRole === 'cashier') {
      return {
        stat1Value: '৳' + toBn(cashierFigures.todayIncome.toLocaleString()), stat1Label: 'আজকের আদায়', stat1Icon: Wallet, stat1Cls: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300',
        stat2Value: toBn(cashierFigures.todayReceipts) + 'টি', stat2Label: 'আজকের রসিদ', stat2Icon: Receipt, stat2Cls: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300',
        stat3Value: '৳' + toBn(allDuesSummary.totalDue.toLocaleString()), stat3Label: 'মোট বকেয়া', stat3Icon: TrendingUp, stat3Cls: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300',
        nextTaskTime: 'ক্যাশিয়ার ডেস্ক',
      };
    } else if (userRole === 'parent') {
      // Guardian-scoped figures ONLY: attendance recorded for their
      // own child(ren) and their own children's dues. (This branch
      // previously read the first class's attendance stats and the
      // whole institution's dues total.)
      const hasChildren = !!guardianChildren && guardianChildren.length > 0;
      return {
        stat1Value: !hasChildren ? '—' : (guardianAttendance.recorded > 0 ? `${toBn(guardianAttendance.rate)}%` : 'রেকর্ড নেই'), stat1Label: 'সন্তানের হাজিরা', stat1Icon: CheckSquare, stat1Cls: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300',
        stat2Value: exams.length > 0 ? (exams[0].name || 'পরীক্ষা') : 'সাময়িক', stat2Label: 'চলমান পরীক্ষা', stat2Icon: Award, stat2Cls: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300',
        stat3Value: '৳' + toBn(guardianDuesTotal.toLocaleString()), stat3Label: 'বকেয়া ফি', stat3Icon: Wallet, stat3Cls: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300',
        nextTaskTime: 'অভিভাবক ডায়েরি',
      };
    }
    return {
      stat1Value: toBn(students.filter(s => s.status === 'Active').length) + ' জন', stat1Label: 'মোট শিক্ষার্থী', stat1Icon: Users, stat1Cls: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300',
      stat2Value: toBn(classes.length) + 'টি', stat2Label: 'মোট শ্রেণি', stat2Icon: GraduationCap, stat2Cls: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300',
      stat3Value: toBn(notices.length) + 'টি', stat3Label: 'সক্রিয় নোটিশ', stat3Icon: Bell, stat3Cls: 'bg-[#fef3c7] text-[#d97706] dark:bg-amber-500/15 dark:text-amber-300',
      nextTaskTime: 'অফিস প্রশাসন',
    };
  }, [userRole, teacherClasses, classStudents, classDuesSummary, allDuesSummary, cashierFigures, students, exams, notices, selectedClass, attendanceStats, guardianChildren, guardianAttendance, guardianDuesTotal]);

  const roleBadges = useMemo(() => {
    if (userRole === 'teacher') {
      return ['শ্রেণি শিক্ষক', selectedClass, `${toBn(classStudents.length)} জন শিক্ষার্থী`];
    }
    if (userRole === 'cashier') return ['হিসাবরক্ষক / ক্যাশিয়ার', 'ফি ও ক্যাশ শাখা', 'রসিদ ইনচার্জ'];
    if (userRole === 'parent') return ['অভিভাবক পোর্টাল', 'সন্তানের তথ্য'];
    if (userRole === 'principal') return ['অধ্যক্ষ', schoolProfile?.nameBn || schoolProfile?.name || 'মাদরাসা', `${toBn(classStudents.length)} জন শিক্ষার্থী`];
    return ['অফিস স্টাফ', 'ভর্তি ও প্রশাসন', 'সার্টিফিকেট শাখা'];
  }, [userRole, selectedClass, classStudents, schoolProfile]);

  const roleTitleBengali: Record<string, string> = {
    teacher: 'শিক্ষক পোর্টাল',
    cashier: 'হিসাবরক্ষক পোর্টাল',
    parent: 'অভিভাবক পোর্টাল',
    staff: 'অফিস স্টাফ পোর্টাল',
    principal: 'অধ্যক্ষ পোর্টাল'
  };

  // Quick Actions per Role
  const roleActions = useMemo(() => {
    if (userRole === 'teacher') {
      return [
        { id: 'attendance', title: 'দৈনিক হাজিরা গ্রহণ', subtitle: `${selectedClass}`, icon: CheckSquare, moduleKey: 'teacher_attendance', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
        { id: 'students_dues', title: 'আমার ক্লাসের ছাত্র ও বকেয়া', icon: Users, moduleKey: 'teacher_students_dues', chip: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300' },
        { id: 'marks', title: 'পরীক্ষার নম্বর এন্ট্রি', subtitle: `${selectedClass}`, icon: PenTool, moduleKey: 'teacher_marks', chip: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300' },
        { id: 'routine', title: 'আমার রুটিন', icon: CalendarDays, moduleKey: 'teacher_routine', chip: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300' }
      ];
    } else if (userRole === 'cashier') {
      return [
        { id: 'finance_collect', title: 'ফি আদায় ও রসিদ', icon: Wallet, moduleKey: 'cashier_collect', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
        { id: 'finance_expense', title: 'দৈনিক খরচ এন্ট্রি', icon: Receipt, moduleKey: 'finance', chip: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300' },
        { id: 'students', title: 'ছাত্র তালিকা ও বকেয়া খতিয়ান', subtitle: 'সকল ক্লাস', icon: Users, moduleKey: 'mobile_students', chip: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300' },
        { id: 'finance_reports', title: 'আর্থিক রিপোর্ট', icon: FileSpreadsheet, moduleKey: 'finance_reports', chip: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300' }
      ];
    } else if (userRole === 'parent') {
      // All three data actions open the guardian SELF-SERVICE portal
      // (own children only) on the matching tab — NOT the shared
      // all-student desktop modules ('results' / 'attendance' /
      // 'finance'), which exposed every student's data to guardians.
      // The tile renderer maps the action id to the portal tab hint.
      return [
        { id: 'results', title: 'পরীক্ষার ফলাফল ও মার্কশিট', icon: Award, moduleKey: 'guardian_portal', chip: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300' },
        { id: 'attendance', title: 'দৈনিক উপস্থিতি ট্র্যাকার', icon: CheckSquare, moduleKey: 'guardian_portal', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
        { id: 'finance', title: 'বেতন ও ফি বিবরণী', icon: Wallet, moduleKey: 'guardian_portal', chip: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300' }
      ];
    }
    if (userRole === 'principal') {
      return [
        { id: 'students', title: 'ছাত্র তালিকা ও বকেয়া', icon: Users, moduleKey: 'mobile_students', chip: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300' },
        { id: 'attendance', title: 'হাজিরা শিট ও রেজিস্টার', icon: CheckSquare, moduleKey: 'attendance', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
        { id: 'finance_collect', title: 'ফি আদায় ও রসিদ', icon: Wallet, moduleKey: 'cashier_collect', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
        { id: 'finance_reports', title: 'আর্থিক রিপোর্ট', icon: FileSpreadsheet, moduleKey: 'finance_reports', chip: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300' }
      ];
    }
    return [
      { id: 'students', title: 'নতুন শিক্ষার্থী ভর্তি ও তালিকা', icon: Users, moduleKey: 'mobile_students', chip: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300' },
      { id: 'id_cards', title: 'আইডি কার্ড ও সনদপত্র', icon: CreditCard, moduleKey: 'student_id_cards', chip: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300' },
      { id: 'attendance', title: 'হাজিরা শিট ও রেজিস্টার', icon: CheckSquare, moduleKey: 'attendance', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' }
    ];
  }, [userRole, selectedClass]);

  // Bottom Nav items per Role — Tutor App pattern: the first 4 tabs are
  // this role's own targets (unchanged), the 5th is "More", which opens
  // a bottom sheet with the role's remaining modules. The profile
  // screen moved into the More sheet (it is still the same screen).
  const bottomNavItems = useMemo(() => {
    const more = { id: 'more', label: 'আরও', icon: LayoutGrid, targetModule: null as string | null };
    if (userRole === 'teacher') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null as string | null },
        { id: 'action1', label: 'হাজিরা', icon: CheckSquare, targetModule: 'teacher_attendance' as string | null },
        { id: 'action2', label: 'বকেয়া', icon: DollarSign, targetModule: 'teacher_students_dues' as string | null },
        { id: 'action3', label: 'নম্বর', icon: PenTool, targetModule: 'teacher_marks' as string | null },
        more
      ];
    } else if (userRole === 'cashier') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null as string | null },
        { id: 'action1', label: 'ফি আদায়', icon: Wallet, targetModule: 'cashier_collect' as string | null },
        { id: 'action2', label: 'রিপোর্ট', icon: FileSpreadsheet, targetModule: 'finance_reports' as string | null },
        { id: 'action3', label: 'ছাত্র', icon: Users, targetModule: 'mobile_students' as string | null },
        more
      ];
    } else if (userRole === 'parent') {
      // Bottom nav opens the guardian portal (own children only) on
      // the matching tab — see handleBottomNavClick for the tab hint.
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null as string | null },
        { id: 'action1', label: 'ফলাফল', icon: Award, targetModule: 'guardian_portal' as string | null },
        { id: 'action2', label: 'হাজিরা', icon: CheckSquare, targetModule: 'guardian_portal' as string | null },
        { id: 'action3', label: 'ফি', icon: Wallet, targetModule: 'guardian_portal' as string | null },
        more
      ];
    }
    if (userRole === 'principal') {
      // Tutor owner-view nav: Dashboard | Fees | Attendance | Students | More.
      // Fees → cashier_collect (the only native mobile fees module: fee
      // search + collect + receipt). The principal passes canCollectFees
      // (hasPermission always passes for owner/admin/principal), so the
      // collect flow is open to them; 'finance' would open the desktop
      // hub via passthrough instead of a mobile-shaped page, and
      // 'finance_reports' (reports) stays in More. No badge: like the
      // cashier's collect tab, this is a collect action, not a dues
      // list — the Due report section below carries the numbers.
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null as string | null },
        { id: 'action1', label: 'ছাত্র', icon: Users, targetModule: 'mobile_students' as string | null },
        { id: 'action2', label: 'ফি', icon: Wallet, targetModule: 'cashier_collect' as string | null },
        { id: 'action3', label: 'হাজিরা', icon: CheckSquare, targetModule: 'attendance' as string | null },
        more
      ];
    }
    return [
      { id: 'home', label: 'হোম', icon: Home, targetModule: null as string | null },
      { id: 'action1', label: 'ছাত্র', icon: Users, targetModule: 'mobile_students' as string | null },
      { id: 'action2', label: 'আইডি কার্ড', icon: CreditCard, targetModule: 'student_id_cards' as string | null },
      { id: 'action3', label: 'নোটিশ', icon: Bell, targetModule: 'notice_board' as string | null },
      more
    ];
  }, [userRole]);

  // "More" sheet items per role — ONLY modules this app already routes
  // to for this role (the roleActions leftovers + the home report
  // destinations) plus the profile screen. No invented entries. A badge
  // appears only where a real count already exists (unread notices).
  const moreItems = useMemo(() => {
    type MoreItem = { id: string; label: string; icon: any; moduleKey: string | null; badge?: number };
    const profileItem: MoreItem = { id: 'profile', label: 'প্রোফাইল', icon: User, moduleKey: null };
    // Step 4: staff leave request (mobile). NOT self-attendance — staff
    // attendance stays admin-only. Principal/guardian do not file leaves.
    const leaveItem: MoreItem = { id: 'leave', label: 'ছুটির আবেদন', icon: Clock, moduleKey: null };
    const settingsItem: MoreItem = { id: 'user_settings', label: language === 'bn' ? 'সেটিংস' : language === 'ar' ? 'الإعدادات' : 'Settings', icon: Settings, moduleKey: 'user_settings' };
    const noticeBadge = notices.length > 0 ? notices.length : undefined;
    if (userRole === 'teacher') {
      return [
        { id: 'routine', label: 'রুটিন', icon: CalendarDays, moduleKey: 'teacher_routine' },
        { id: 'notices', label: 'নোটিশ', icon: Bell, moduleKey: 'teacher_notices', badge: noticeBadge },
        { id: 'report_attendance', label: 'হাজিরা রিপোর্ট', icon: BarChart3, moduleKey: 'teacher_report_attendance' },
        { id: 'report_result', label: 'ফলাফল রিপোর্ট', icon: Award, moduleKey: 'teacher_report_result' },
        leaveItem,
        settingsItem,
        profileItem
      ] as MoreItem[];
    }
    if (userRole === 'cashier') {
      return [
        { id: 'finance_expense', label: 'খরচ এন্ট্রি', icon: Receipt, moduleKey: 'finance' },
        leaveItem,
        settingsItem,
        profileItem
      ] as MoreItem[];
    }
    if (userRole === 'parent') {
      return [
        { id: 'notices', label: 'নোটিশ', icon: Bell, moduleKey: 'notice_board', badge: noticeBadge },
        settingsItem,
        profileItem
      ] as MoreItem[];
    }
    if (userRole === 'principal') {
      // Only destinations already routed for this app: reports, notices,
      // ID cards, profile. (No generic routine/settings tab key was
      // verified for mobile passthrough, so none is invented here.)
      return [
        { id: 'finance_reports', label: 'আর্থিক রিপোর্ট', icon: FileSpreadsheet, moduleKey: 'finance_reports' },
        { id: 'notices', label: 'নোটিশ', icon: Bell, moduleKey: 'notice_board', badge: noticeBadge },
        { id: 'id_cards', label: 'আইডি কার্ড', icon: CreditCard, moduleKey: 'student_id_cards' },
        settingsItem,
        profileItem
      ] as MoreItem[];
    }
    return [
      { id: 'attendance', label: 'হাজিরা', icon: CheckSquare, moduleKey: 'attendance' },
      leaveItem,
      settingsItem,
      profileItem
    ] as MoreItem[];
  }, [userRole, notices.length, language]);

  // The More button counts as active when the open screen is one of the
  // More-sheet destinations (or the profile screen reached from it).
  const moreActive = showProfile || showLeave ||
    (activeSubModule !== null && moreItems.some(m => m.moduleKey !== null && m.moduleKey === activeSubModule));

  // Lock body scroll while the More sheet is open (Tutor pattern).
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [moreOpen]);

  const NATIVE_MODULES = ['teacher_attendance', 'teacher_students_dues', 'teacher_marks', 'teacher_notices', 'teacher_report_attendance', 'teacher_report_result', 'teacher_routine', 'cashier_collect', 'mobile_students'];

  const handleOpenModule = (moduleKey: string) => {
    // For shared desktop modules, switch the app tab first so the
    // passthrough renders the right module (the old view missed this).
    if (!NATIVE_MODULES.includes(moduleKey) && setActiveTab) {
      setActiveTab(moduleKey as any);
    }
    setShowProfile(false);
    setShowLeave(false);
    setActiveSubModule(moduleKey);
  };

  const handleBottomNavClick = (nav: typeof bottomNavItems[0]) => {
    setActiveBottomNav(nav.id);
    if (nav.id === 'more') {
      setMoreOpen(true);
      return;
    }
    if (nav.id === 'profile') {
      setActiveSubModule(null);
      setShowProfile(true);
      return;
    }
    setShowProfile(false);
    setShowLeave(false);
    if (nav.targetModule) {
      // Guardian bottom nav: open the portal on the tapped tab.
      if (nav.targetModule === 'guardian_portal') {
        setPortalTabHint(nav.id === 'action2' ? 'attendance' : nav.id === 'action3' ? 'fees' : 'results');
      }
      handleOpenModule(nav.targetModule);
    } else {
      setActiveSubModule(null);
    }
  };

  const goHome = () => {
    setActiveSubModule(null);
    setShowProfile(false);
    setShowLeave(false);
    setMoreOpen(false);
    setActiveBottomNav('home');
  };

  const displayName = authUser?.displayName || currentMember?.displayName || currentUser?.name || 'সম্মানিত ব্যবহারকারী';
  const initialLetter = (displayName || 'উ')[0].toUpperCase();

  // Search & Filter state for Students & Dues module
  const [duesSearchQuery, setDuesSearchQuery] = useState('');
  const [duesFilterMode, setDuesFilterMode] = useState<'ALL' | 'DUE_ONLY' | 'PAID_ONLY'>('ALL');

  // Phase 3: fee-month view — the dues list can be viewed for a past
  // month (calculateSingleStudentDue's existing targetMonth param).
  // Past months use the CURRENT class fee structure (same stated
  // limitation as fee aging); the TOTAL DUE banner always shows the
  // live overall position (current month + aged).
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [duesViewMonth, setDuesViewMonth] = useState<string>(currentMonthStr);
  const feeMonthOptions = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  }, []);
  const viewDuesSummary = useMemo(() => {
    if (duesViewMonth === currentMonthStr) return classDuesSummary;
    return calculateClassDuesSummary(classStudents, feeStructures, transactions, duesViewMonth);
  }, [duesViewMonth, currentMonthStr, classDuesSummary, classStudents, feeStructures, transactions]);

  const filteredDuesProfiles = useMemo(() => {
    return viewDuesSummary.profiles.filter(p => {
      if (duesFilterMode === 'DUE_ONLY' && p.dueThisMonth <= 0) return false;
      if (duesFilterMode === 'PAID_ONLY' && p.dueThisMonth > 0) return false;

      if (!duesSearchQuery.trim()) return true;
      const q = duesSearchQuery.toLowerCase().trim();
      const st = p.student;
      return (
        (st.name && st.name.toLowerCase().includes(q)) ||
        (st.nameBn && st.nameBn.includes(q)) ||
        (st.roll && String(st.roll).includes(q)) ||
        (st.rollNumber && String(st.rollNumber).includes(q)) ||
        (st.guardianPhone && String(st.guardianPhone).includes(q))
      );
    });
  }, [viewDuesSummary, duesSearchQuery, duesFilterMode]);

  // Phase 3: native mobile Students list (Tutor pattern). Scope:
  // cashier/staff/principal see all students (the desktop
  // StudentManager's list scope); teacher has no students tab (their
  // view is teacher_students_dues) and guardians stay in the portal.
  // Active convention mirrors the existing filters: status 'Active'
  // (or 'active') and not former; everything else counts as inactive
  // for the filter. Mutations reuse the context handlers; the status
  // toggle writes the capitalized 'Active'/'Inactive' values the
  // existing filters already match on.
  const [studentsSearch, setStudentsSearch] = useState('');
  const [studentsClass, setStudentsClass] = useState<string>('all');
  const [studentsStatus, setStudentsStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  // Truthful-save Step 2-বাকি: student toggle/delete failure state.
  // The local change always stays; retry re-confirms only.
  const [studentCloudFailure, setStudentCloudFailure] = useState<string | null>(null);
  const [pendingStudentToggle, setPendingStudentToggle] = useState<Student[] | null>(null);
  const [pendingStudentDelete, setPendingStudentDelete] = useState<{ students: Student[]; trashBin: TrashItem[] } | null>(null);

  // Student status toggle with truthful-save: success notice only
  // after the cloud write lands; failure shows the amber banner.
  const handleToggleStudentStatus = async (st: Student, active: boolean) => {
    if (!updateStudent) return;
    const result = updateStudent({ ...st, status: active ? 'Inactive' : 'Active' });
    const confirmResult = await confirmStudentsCloudSync(result.students);
    if (confirmResult.success) {
      setStudentCloudFailure(null);
      setPendingStudentToggle(null);
      setSaveSuccessNotice(isEn ? '✓ Student status updated!' : '✓ শিক্ষার্থীর স্ট্যাটাস আপডেট হয়েছে!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } else {
      setStudentCloudFailure(confirmResult.message || STUDENTS_CLOUD_FAILURE_MESSAGE);
      setPendingStudentToggle(result.students);
    }
  };

  // Retry re-confirms the last failed toggle/delete list (never re-applies).
  const handleRetryStudentCloudSync = async () => {
    if (pendingStudentDelete) {
      const result = await confirmStudentDeleteCloudSync(pendingStudentDelete.students, pendingStudentDelete.trashBin);
      if (result.success) {
        setStudentCloudFailure(null);
        setPendingStudentDelete(null);
        setStudentToDelete(null);
        setSaveSuccessNotice(isEn ? '✓ Student deleted!' : '✓ শিক্ষার্থী ডিলিট হয়েছে!');
        setTimeout(() => setSaveSuccessNotice(null), 3000);
      } else {
        setStudentCloudFailure(result.message || STUDENT_DELETE_CLOUD_FAILURE_MESSAGE);
      }
      return;
    }
    if (!pendingStudentToggle) return;
    const result = await confirmStudentsCloudSync(pendingStudentToggle);
    if (result.success) {
      setStudentCloudFailure(null);
      setPendingStudentToggle(null);
      setSaveSuccessNotice(isEn ? '✓ Student status updated!' : '✓ শিক্ষার্থীর স্ট্যাটাস আপডেট হয়েছে!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } else {
      setStudentCloudFailure(result.message || STUDENTS_CLOUD_FAILURE_MESSAGE);
    }
  };

  // Student delete confirm: dialog stays open on cloud failure, its
  // confirm button becomes the retry (re-confirm only, never re-deletes).
  const handleConfirmStudentDelete = async () => {
    if (pendingStudentDelete) {
      await handleRetryStudentCloudSync();
      return;
    }
    if (!studentToDelete || !deleteStudent) return;
    const result = deleteStudent(studentToDelete.id);
    if (!result) {
      setStudentToDelete(null);
      return;
    }
    const confirmResult = await confirmStudentDeleteCloudSync(result.students, result.trashBin);
    if (confirmResult.success) {
      setStudentCloudFailure(null);
      setPendingStudentDelete(null);
      setStudentToDelete(null);
      setSaveSuccessNotice(isEn ? '✓ Student deleted!' : '✓ শিক্ষার্থী ডিলিট হয়েছে!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } else {
      setStudentCloudFailure(confirmResult.message || STUDENT_DELETE_CLOUD_FAILURE_MESSAGE);
      setPendingStudentDelete({ students: result.students, trashBin: result.trashBin });
    }
  };
  const canManageStudents = useMemo(() => {
    try {
      if (typeof hasPermission !== 'function') return false;
      return !!((hasPermission as any)('students.create') || (hasPermission as any)('students.edit'));
    } catch {
      return false;
    }
  }, [hasPermission]);
  const isStudentActive = (s: Student) => (s.status === 'Active' || s.status === 'active') && !s.isFormer;
  const studentStatusLabel = (s: Student) => {
    if (s.isFormer || s.status === 'Former') return isEn ? 'Former' : 'সাবেক';
    if (isStudentActive(s)) return isEn ? 'Active' : 'সক্রিয়';
    return isEn ? 'Inactive' : 'নিষ্ক্রিয়';
  };
  const studentClassNames = useMemo(() => {
    const names: string[] = [];
    classes.forEach(c => { if (c.name && !names.includes(c.name)) names.push(c.name); });
    students.forEach(s => { if (s.classLevel && !names.includes(s.classLevel)) names.push(s.classLevel); });
    return names;
  }, [classes, students]);
  const filteredMobileStudents = useMemo(() => {
    const q = studentsSearch.toLowerCase().trim();
    return students.filter(s => {
      if (studentsClass !== 'all' && s.classLevel !== studentsClass) return false;
      if (studentsStatus === 'active' && !isStudentActive(s)) return false;
      if (studentsStatus === 'inactive' && isStudentActive(s)) return false;
      if (!q) return true;
      return (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.nameBn && s.nameBn.includes(q)) ||
        (s.roll && String(s.roll).includes(q)) ||
        (s.rollNumber && String(s.rollNumber).includes(q)) ||
        (s.studentId && String(s.studentId).toLowerCase().includes(q)) ||
        (s.guardianPhone && String(s.guardianPhone).includes(q)) ||
        (s.classLevel && s.classLevel.toLowerCase().includes(q))
      );
    });
  }, [students, studentsSearch, studentsClass, studentsStatus]);

  // Phase 3: Copy All Numbers — clipboard copy of the guardian phones
  // of the currently listed DUE students (same clipboard approach as
  // the per-student copy; no SMS is sent from here).
  const [copiedAllNumbers, setCopiedAllNumbers] = useState(false);
  const handleCopyAllNumbers = (profiles: StudentDueProfile[]) => {
    const phones = Array.from(new Set(
      profiles.filter(p => p.dueThisMonth > 0 && p.student.guardianPhone).map(p => String(p.student.guardianPhone))
    ));
    if (phones.length === 0) return;
    navigator.clipboard.writeText(phones.join(', '));
    setCopiedAllNumbers(true);
    setTimeout(() => setCopiedAllNumbers(false), 2500);
  };

  // Copy SMS text handler
  const handleCopySms = (profile: StudentDueProfile) => {
    const text = getDueReminderMessage(
      profile.student.nameBn || profile.student.name,
      profile.classLevel,
      profile.dueThisMonth,
      schoolProfile.nameBn || schoolProfile.name
    );
    navigator.clipboard.writeText(text);
    setCopiedStudentId(profile.student.id);
    setTimeout(() => setCopiedStudentId(null), 2500);
  };

  const whatsappLink = (profile: StudentDueProfile) => {
    const phone = String(profile.student.guardianPhone || '').replace(/[^0-9]/g, '');
    if (!phone) return null;
    const intl = phone.startsWith('880') ? phone : '880' + phone.replace(/^0/, '');
    const text = getDueReminderMessage(
      profile.student.nameBn || profile.student.name,
      profile.classLevel,
      profile.dueThisMonth,
      schoolProfile.nameBn || schoolProfile.name
    );
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  };

  // Phase 2: WhatsApp reminder for AGED dues (old months included).
  // Unlike getDueReminderMessage (which says "চলতি মাসের ফি বাবদ"),
  // this text honestly says the total covers old months too. Used
  // only by the new mobile Due report rows.
  const agedWhatsappLink = (student: Student, totalAged: number) => {
    const phone = String(student.guardianPhone || '').replace(/[^0-9]/g, '');
    if (!phone) return null;
    const intl = phone.startsWith('880') ? phone : '880' + phone.replace(/^0/, '');
    const text = `আসসালামু আলাইকুম। ${schoolProfile.nameBn || schoolProfile.name}-এর শিক্ষার্থী ${student.nameBn || student.name} (${student.classLevel})-এর পুরনো মাসসহ মোট ৳${totalAged.toLocaleString()} বকেয়া রয়েছে। অনুগ্রহপূর্বক দ্রুত বকেয়া পরিশোধ করার অনুরোধ করা হলো। জাযাকাল্লাহু খাইরান।`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  };

  // -------------------------------------------------------------
  // Phase 2 additions: marks-entry permission gate + class reports
  // -------------------------------------------------------------
  // Marks entry is allowed only when the admin has granted the
  // marks.create / marks.edit permission to this user's role
  // (managed from User & Role Management). Otherwise marks are view-only.
  const canEnterMarks = useMemo(() => {
    try {
      if (typeof hasPermission !== 'function') return true;
      return !!(hasPermission('marks.create' as any) || hasPermission('marks.edit' as any));
    } catch {
      return true;
    }
  }, [hasPermission, currentMember, currentUser]);

  // This month's attendance report for the teacher's selected class
  const monthlyAttendance = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const perStudent = new Map<string, { present: number; absent: number; late: number; leave: number; total: number }>();
    let totalRecords = 0;
    let presentRecords = 0;
    const days = new Set<string>();
    for (let d = 1; d <= 31; d++) {
      const dateStr = `${prefix}-${String(d).padStart(2, '0')}`;
      const recs = filterStudentRecordsByDateAndClass(dailyStudentAttendance, dateStr, selectedClass);
      if (recs.length > 0) days.add(dateStr);
      recs.forEach(r => {
        totalRecords++;
        if (r.status === 'PRESENT' || r.status === 'LATE') presentRecords++;
        const cur = perStudent.get(r.studentId) || { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
        cur.total++;
        if (r.status === 'PRESENT') cur.present++;
        else if (r.status === 'ABSENT') cur.absent++;
        else if (r.status === 'LATE') cur.late++;
        else if (r.status === 'LEAVE') cur.leave++;
        perStudent.set(r.studentId, cur);
      });
    }
    const rate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
    return { schoolDays: days.size, totalRecords, rate, perStudent };
  }, [selectedClass, attendanceDate, dailyStudentAttendance]);

  // Latest exam result summary for the teacher's class
  const classResultReport = useMemo(() => {
    const exam = exams.length > 0 ? exams[exams.length - 1] : null;
    if (!exam) return null;
    const rows = classStudents.map(st => {
      const has = marks.some(m => m.studentId === st.id && m.examId === exam.id);
      const res = calculateTotalGPA(classSubjects, marks, st.id, exam.id, st.group, exams);
      return { student: st, has, ...res };
    });
    const appeared = rows.filter(r => r.has);
    const passed = appeared.filter(r => !r.isFail);
    const avgGpa = appeared.length > 0 ? appeared.reduce((s, r) => s + r.gpa, 0) / appeared.length : 0;
    const passRate = appeared.length > 0 ? Math.round((passed.length / appeared.length) * 100) : 0;
    const sorted = [...rows].sort((a, b) => b.gpa - a.gpa || b.totalMarks - a.totalMarks);
    return { exam, rows: sorted, appeared: appeared.length, passed: passed.length, failed: appeared.length - passed.length, avgGpa, passRate };
  }, [exams, marks, classStudents, classSubjects]);

  // This month's fee collection for the teacher's class
  const classFeeReport = useMemo(() => {
    const expected = classDuesSummary.profiles.reduce((s, p) => s + (p.monthlyExpected || 0), 0);
    const paid = classDuesSummary.profiles.reduce((s, p) => s + (p.paidThisMonth || 0), 0);
    const pct = expected > 0 ? Math.round((paid / expected) * 100) : 0;
    return { expected, paid, pct };
  }, [classDuesSummary]);

  // Accountant: today's expense + top dues list
  const todayExpense = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return transactions
      .filter(t => t.type === 'EXPENSE' && (t.date?.startsWith(todayStr)))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const topDueProfiles = useMemo(() => {
    return [...allDuesSummary.profiles]
      .filter(p => p.dueThisMonth > 0)
      .sort((a, b) => b.dueThisMonth - a.dueThisMonth)
      .slice(0, 5);
  }, [allDuesSummary]);

  // -------------------------------------------------------------
  // Phase 2 additions: Tutor-style report sections for the homes.
  // Every number below comes from an existing memo/service — no new
  // metrics, no desktop-screen behaviour change. Fee aging is the
  // additive calculateFeeAging only (see services/studentDuesService).
  // -------------------------------------------------------------
  // Fee aging per student (transactions pre-grouped once, so this is
  // not O(students x transactions) through the service filter).
  const agingByStudent = useMemo(() => {
    const byId = new Map<string, FinanceTransaction[]>();
    transactions.forEach(tx => {
      if (tx.type === 'INCOME' && tx.studentId) {
        const arr = byId.get(tx.studentId) || [];
        arr.push(tx);
        byId.set(tx.studentId, arr);
      }
    });
    const out = new Map<string, FeeAging>();
    students.forEach(st => {
      const mine = [...(byId.get(st.id) || [])];
      if (st.studentId && st.studentId !== st.id) mine.push(...(byId.get(st.studentId) || []));
      out.set(st.id, calculateFeeAging(st, feeStructures, mine));
    });
    return out;
  }, [students, feeStructures, transactions]);

  const summarizeAging = (list: Student[]) => {
    const rows = list.map(st => ({
      student: st,
      profile: allDuesSummary.profiles.find(p => p.student.id === st.id) || null,
      aging: agingByStudent.get(st.id)
    })).filter(r => !!r.aging) as { student: Student; profile: StudentDueProfile | null; aging: FeeAging }[];
    const oneMonthOld = rows.reduce((s, r) => s + r.aging.oneMonthOld, 0);
    const twoPlus = rows.reduce((s, r) => s + r.aging.twoPlusMonthsOld, 0);
    const agedRows = rows
      .filter(r => r.aging.totalAged > 0)
      .sort((a, b) => b.aging.totalAged - a.aging.totalAged);
    return { oneMonthOld, twoPlus, totalAged: oneMonthOld + twoPlus, agedRows };
  };

  // Teacher: aging over the selected assigned class only.
  const teacherAging = useMemo(
    () => summarizeAging(classStudents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classStudents, agingByStudent, allDuesSummary]
  );

  // Cashier: aging over all active students.
  const cashierAging = useMemo(() => {
    const active = students.filter(s => s.status === 'Active' && !s.isFormer);
    return summarizeAging(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, agingByStudent, allDuesSummary]);

  // Cashier: fee collection per month for the last 6 months (by the
  // date the money was received — real INCOME rows only) + this
  // month's expected vs collected from the existing dues summary.
  const monthlyCollectionTrend = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const sums = new Map<string, number>(keys.map(k => [k, 0]));
    transactions.forEach(t => {
      if (t.type !== 'INCOME') return;
      const k = (t.date || '').slice(0, 7);
      if (sums.has(k)) sums.set(k, sums.get(k)! + (Number(t.amount) || 0));
    });
    const months = keys.map(k => ({ month: k, collected: sums.get(k) || 0 }));
    return {
      months,
      max: Math.max(...months.map(m => m.collected), 1),
      thisMonthExpected: allDuesSummary.totalExpected,
      thisMonthPaid: allDuesSummary.totalPaid
    };
  }, [transactions, allDuesSummary]);

  // -------------------------------------------------------------
  // Phase 1b additions: principal whole-madrasa summaries. Same
  // honesty patterns as components/MadrasaReports.tsx (recorded-only
  // attendance with not-taken states, real ledger money, no invented
  // figures) — but computed here with small memos from context data
  // instead of importing MadrasaReports, which is a desktop Dashboard
  // component and must not join the mobile chunk. Non-principal homes
  // skip the loops entirely (early return).
  // -------------------------------------------------------------
  // Today's recorded-only attendance across ALL classes.
  const principalTodayAttendance = useMemo(() => {
    if (userRole !== 'principal') return { total: 0, present: 0, rate: 0 };
    const todayStr = new Date().toISOString().split('T')[0];
    let total = 0;
    let present = 0;
    classes.forEach(c => {
      const recs = filterStudentRecordsByDateAndClass(dailyStudentAttendance, todayStr, c.name || '');
      recs.forEach(r => {
        total++;
        if (r.status === 'PRESENT' || r.status === 'LATE') present++;
      });
    });
    return { total, present, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
  }, [userRole, classes, attendanceDate, dailyStudentAttendance]);

  // This month: ledger income/expense/net + recorded-days-only
  // attendance (days with at least one record in any class).
  const principalMonthSummary = useMemo(() => {
    if (userRole !== 'principal') {
      return { income: 0, expense: 0, net: 0, attTotal: 0, attRate: 0, recordedDays: 0 };
    }
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const income = transactions
      .filter(t => t.type === 'INCOME' && (t.date || '').startsWith(prefix))
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = transactions
      .filter(t => t.type === 'EXPENSE' && (t.date || '').startsWith(prefix))
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    let attTotal = 0;
    let attPresent = 0;
    const days = new Set<string>();
    for (let d = 1; d <= 31; d++) {
      const dateStr = `${prefix}-${String(d).padStart(2, '0')}`;
      let dayHas = false;
      classes.forEach(c => {
        const recs = filterStudentRecordsByDateAndClass(dailyStudentAttendance, dateStr, c.name || '');
        if (recs.length > 0) dayHas = true;
        recs.forEach(r => {
          attTotal++;
          if (r.status === 'PRESENT' || r.status === 'LATE') attPresent++;
        });
      });
      if (dayHas) days.add(dateStr);
    }
    return {
      income,
      expense,
      net: income - expense,
      attTotal,
      attRate: attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0,
      recordedDays: days.size
    };
  }, [userRole, transactions, classes, dailyStudentAttendance]);

  // Principal stat cards: whole-madrasa figures. Total dues = the
  // existing current-month dues total + the Phase 2 aged total
  // (calculateFeeAging, reused as-is over all active students).
  const principalStatCards = useMemo(() => {
    const activeCount = students.filter(s => s.status === 'Active' && !s.isFormer).length;
    const totalDue = allDuesSummary.totalDue + cashierAging.totalAged;
    return [
      { value: toBn(activeCount) + ' জন', label: 'মোট শিক্ষার্থী', Icon: Users, cls: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300' },
      { value: '৳' + toBn(cashierFigures.todayIncome.toLocaleString()), label: 'আজকের আদায়', Icon: Wallet, cls: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
      { value: '৳' + toBn(totalDue.toLocaleString()), label: 'মোট বকেয়া', Icon: TrendingUp, cls: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300' }
    ];
  }, [students, allDuesSummary, cashierAging, cashierFigures]);

  // Teacher: this month's attendance rate per assigned class (same
  // recorded-only counting as monthlyAttendance, per class).
  const teacherClassAttendance = useMemo(() => {
    if (userRole !== 'teacher') return [];
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return teacherClasses.map(cls => {
      let total = 0;
      let present = 0;
      const days = new Set<string>();
      for (let d = 1; d <= 31; d++) {
        const dateStr = `${prefix}-${String(d).padStart(2, '0')}`;
        const recs = filterStudentRecordsByDateAndClass(dailyStudentAttendance, dateStr, cls);
        if (recs.length > 0) days.add(dateStr);
        recs.forEach(r => {
          total++;
          if (r.status === 'PRESENT' || r.status === 'LATE') present++;
        });
      }
      return { className: cls, rate: total > 0 ? Math.round((present / total) * 100) : 0, days: days.size };
    });
  }, [userRole, teacherClasses, attendanceDate, dailyStudentAttendance]);

  // Staff: active students grouped by class, in class order.
  const staffByClass = useMemo(() => {
    const active = students.filter(s => s.status === 'Active' && !s.isFormer);
    const counts = new Map<string, number>();
    active.forEach(s => counts.set(s.classLevel, (counts.get(s.classLevel) || 0) + 1));
    const ordered = classes.map(c => c.name).filter(n => counts.has(n));
    const rest = [...counts.keys()].filter(n => !ordered.includes(n)).sort();
    return [...ordered, ...rest].map(n => ({ className: n, count: counts.get(n) || 0 }));
  }, [students, classes]);

  // Guardian: per-child report rows — own children ONLY (same resolver
  // and recorded-only attendance as the existing guardian memos).
  const guardianChildReports = useMemo(() => {
    if (!guardianChildren) return null;
    const exam = exams.length > 0 ? exams[exams.length - 1] : null;
    return guardianChildren.map(child => {
      const att = calculateStudentAttendanceForExamFromRecords(dailyStudentAttendance, child.id);
      const due = calculateSingleStudentDue(child, feeStructures, transactions);
      const aging = agingByStudent.get(child.id) || null;
      let examRes: { gpa: number; isFail: boolean; has: boolean } | null = null;
      if (exam) {
        const has = marks.some(m => m.studentId === child.id && m.examId === exam.id);
        const res = calculateTotalGPA(
          subjects.filter(s => s.classLevel === child.classLevel || (s as any).classId === child.classLevel),
          marks, child.id, exam.id, child.group, exams
        );
        examRes = { gpa: res.gpa, isFail: res.isFail, has };
      }
      return {
        child,
        attendanceRate: att.workingDays > 0 ? Math.round((att.totalPresent / att.workingDays) * 100) : 0,
        recordedDays: att.workingDays,
        due,
        aging,
        exam,
        examRes
      };
    });
  }, [guardianChildren, exams, marks, subjects, feeStructures, transactions, agingByStudent, dailyStudentAttendance]);

  // -------------------------------------------------------------
  // Phase 4 additions: teacher class routine + native cashier fee entry
  // -------------------------------------------------------------
  // Routine data comes from the cloud-synced classRoutines in context
  // (services/academicScheduleService bridge → main_store). Each routine
  // item carries teacherId + teacherName per period, so the teacher's own
  // periods are matched by linked teacher record id first, then by name.
  const normalizeName = (s?: string | null) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // The linkage is deliberately ROLE-AGNOSTIC: any linked staff record
  // counts, whatever the person's login role is. A principal (or an
  // accountant) who also teaches is matched through their staff record
  // — by uid link, record id, email, or phone — never by requiring
  // role === 'teacher'. (Multi-role: routine follows the staff record,
  // not the primary role.)
  const myTeacherRecord = useMemo(() => {
    const uid = authUser?.uid;
    const email = (authUser?.email || currentUser?.email || '').toLowerCase();
    const phone = currentUser?.phone || currentMember?.phone || '';
    return (
      teachers.find(t => uid && t.userId && t.userId === uid) ||
      teachers.find(t => currentUser?.id && t.id === currentUser.id) ||
      teachers.find(t => email && t.email && t.email.toLowerCase() === email) ||
      teachers.find(t => phone && t.phone && t.phone === phone) ||
      null
    );
  }, [teachers, authUser, currentUser, currentMember]);

  const myNameSet = useMemo(() => {
    return new Set(
      [myTeacherRecord?.name, myTeacherRecord?.nameBn, currentUser?.name, currentUser?.nameBn, authUser?.displayName]
        .map(n => normalizeName(n))
        .filter(Boolean)
    );
  }, [myTeacherRecord, currentUser, authUser]);

  // ---------------------------------------------------------------
  // Step 4 handlers: staff leave request + own profile edit.
  // Leave requests are ALWAYS PENDING (buildStaffLeaveRequest hard-codes
  // it) and follow the truthful-save pattern: success only after the
  // awaited cloud confirmation, otherwise an honest failure banner with
  // a retry that re-confirms the still-local records (no re-filing).
  // Staff self-attendance is deliberately NOT here (admin-only).
  // ---------------------------------------------------------------
  const myLeaveIdentity = myTeacherRecord?.id || currentUser?.id || '';
  const myLeaves = useMemo(
    () => (staffLeaves || []).filter((l) => l.teacherId === myLeaveIdentity),
    [staffLeaves, myLeaveIdentity]
  );

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (leaveSubmitting) return;
    const days = computeLeaveDays(leaveStart, leaveEnd);
    if (!days) {
      setLeaveFailure(isEn ? 'End date must not be before start date.' : 'শেষ তারিখ শুরুর তারিখের আগে হতে পারবে না।');
      return;
    }
    if (!myLeaveIdentity) {
      setLeaveFailure(isEn ? 'No staff record is linked to this account — please contact the office.' : 'এই অ্যাকাউন্টের সাথে কোনো স্টাফ রেকর্ড যুক্ত নেই — অফিসে যোগাযোগ করুন।');
      return;
    }
    setLeaveSubmitting(true);
    try {
      const record = buildStaffLeaveRequest(
        {
          teacherId: myLeaveIdentity,
          teacherName: myTeacherRecord?.nameBn || myTeacherRecord?.name || displayName,
          designation: myTeacherRecord?.designation || currentUser?.designation || '',
          leaveType,
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: leaveReason.trim(),
        },
        `leave_${Date.now()}`
      );
      const next = [record, ...staffLeaves];
      setStaffLeaves(next);
      const result = await confirmLeavesCloudSync(next);
      if (result.success) {
        setLeaveFailure(null);
        setLeaveSuccess(isEn ? 'Leave request submitted — pending approval.' : 'ছুটির আবেদন জমা হয়েছে — অনুমোদনের অপেক্ষায় আছে।');
        setLeaveReason('');
        setTimeout(() => setLeaveSuccess(null), 3500);
      } else {
        setLeaveFailure(result.message || LEAVE_CLOUD_FAILURE_MESSAGE);
      }
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const retryLeaveCloudSync = async () => {
    const result = await confirmLeavesCloudSync();
    if (result.success) {
      setLeaveFailure(null);
      setLeaveSuccess(isEn ? 'Leave request synced to cloud.' : 'ছুটির আবেদন cloud-এ পৌঁছেছে।');
      setTimeout(() => setLeaveSuccess(null), 3500);
    } else {
      setLeaveFailure(result.message || LEAVE_CLOUD_FAILURE_MESSAGE);
    }
  };

  const startProfileEdit = () => {
    if (!myTeacherRecord) return;
    setEditName(myTeacherRecord.name || '');
    setEditNameBn(myTeacherRecord.nameBn || '');
    setEditEmployeeCode(myTeacherRecord.employeeCode || '');
    setProfileFailure(null);
    setEditingProfile(true);
  };

  const handleSaveProfileEdit = async () => {
    if (!myTeacherRecord) return;
    const updated = sanitizeProfileEdit(myTeacherRecord, {
      name: editName,
      nameBn: editNameBn,
      employeeCode: editEmployeeCode,
    });
    const res = await updateTeacher(updated);
    // Phase 2: a validation error must not become a success message.
    if (res.error) {
      setProfileFailure(res.error);
      return;
    }
    const result = await confirmStaffCloudSync(res.nextTeachers, res.nextUsers);
    if (result.success) {
      setProfileFailure(null);
      setProfileSuccess(isEn ? 'Profile updated.' : 'প্রোফাইল আপডেট হয়েছে।');
      setEditingProfile(false);
      setTimeout(() => setProfileSuccess(null), 3500);
    } else {
      setProfileFailure(result.message || STAFF_CLOUD_FAILURE_MESSAGE);
    }
  };

  const retryProfileCloudSync = async () => {
    const result = await confirmStaffCloudSync();
    if (result.success) {
      setProfileFailure(null);
      setProfileSuccess(isEn ? 'Profile synced to cloud.' : 'প্রোফাইল cloud-এ পৌঁছেছে।');
      setTimeout(() => setProfileSuccess(null), 3500);
    } else {
      setProfileFailure(result.message || STAFF_CLOUD_FAILURE_MESSAGE);
    }
  };

  const activeRoutineItems = useMemo(() => {
    return (classRoutines || []).filter(r => !r.status || r.status === 'ACTIVE');
  }, [classRoutines]);

  const myRoutineItems = useMemo(() => {
    return activeRoutineItems.filter(r =>
      (myTeacherRecord?.id && r.teacherId === myTeacherRecord.id) ||
      (r.teacherName && myNameSet.has(normalizeName(r.teacherName)))
    );
  }, [activeRoutineItems, myTeacherRecord, myNameSet]);

  // Fallback: if no period in the whole week is linked to this teacher
  // (e.g. routines were entered by class only), show the routine of the
  // teacher's own assigned class(es) — still strictly their class data.
  const routineIsClassFallback = myRoutineItems.length === 0;

  const routineItems = useMemo(() => {
    if (!routineIsClassFallback) return myRoutineItems;
    const classNames = new Set<string>();
    teacherClasses.forEach(c => classNames.add(normalizeName(c)));
    classes.forEach(c => {
      if (teacherClasses.includes(c.name)) {
        if (c.nameBn) classNames.add(normalizeName(c.nameBn));
        if (c.displayName) classNames.add(normalizeName(c.displayName));
      }
    });
    return activeRoutineItems.filter(r => classNames.has(normalizeName(r.classLevel)));
  }, [routineIsClassFallback, myRoutineItems, activeRoutineItems, teacherClasses, classes]);

  const todayDayEn = useMemo<DayOfWeek>(() => {
    const names: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return names[new Date().getDay()];
  }, []);

  const [routineDay, setRoutineDay] = useState<DayOfWeek>(todayDayEn);

  const routineDayItems = useMemo(() => {
    return routineItems
      .filter(r => r.dayOfWeek === routineDay)
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }, [routineItems, routineDay]);

  const todaysRoutineItems = useMemo(() => {
    return routineItems
      .filter(r => r.dayOfWeek === todayDayEn)
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }, [routineItems, todayDayEn]);

  const routineSubjectName = (item: (typeof routineItems)[number]) => {
    if (item.subjectName) return item.subjectName;
    const sub = subjects.find(s => s.id === item.subjectId);
    return sub ? (sub.nameBn || sub.name) : item.subjectId;
  };

  // Fee entry is gated by the same permission helpers as the rest of the
  // app (accountant role gets finance./fees./payments. in hasPermission;
  // owner/admin/principal always pass inside hasPermission itself).
  const canCollectFees = useMemo(() => {
    try {
      if (typeof hasPermission !== 'function') return userRole === 'cashier';
      return !!(
        hasPermission('fees.create' as any) ||
        hasPermission('finance.create' as any) ||
        hasPermission('payments.create' as any)
      );
    } catch {
      return userRole === 'cashier';
    }
  }, [hasPermission, currentMember, currentUser, userRole]);

  const FEE_METHODS: { id: PaymentMethod; bn: string; en: string }[] = [
    { id: 'CASH', bn: 'নগদ টাকা', en: 'Cash' },
    { id: 'BKASH', bn: 'বিকাশ', en: 'bKash' },
    { id: 'NAGAD', bn: 'নগদ', en: 'Nagad' },
    { id: 'ROCKET', bn: 'রকেট', en: 'Rocket' },
    { id: 'BANK_TRANSFER', bn: 'ব্যাংক', en: 'Bank' }
  ];

  const [feeSearchQuery, setFeeSearchQuery] = useState('');
  const [feeStudentId, setFeeStudentId] = useState<string | null>(null);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeMethod, setFeeMethod] = useState<PaymentMethod>('CASH');
  const [feeRefNo, setFeeRefNo] = useState('');
  const [feeNote, setFeeNote] = useState('');
  const [lastReceipt, setLastReceipt] = useState<{ tx: FinanceTransaction; remainingDue: number; cloudConfirmed: boolean } | null>(null);

  // Phase 3: cashier fee-month view (same targetMonth mechanism as
  // the teacher dues page; the collect form itself still records the
  // current month's feeMonth, as before).
  const [cashierViewMonth, setCashierViewMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const viewFeeProfiles = useMemo(() => {
    const current = new Date().toISOString().slice(0, 7);
    if (cashierViewMonth === current) return allDuesSummary.profiles;
    const active = students.filter(s => s.status === 'Active' && !s.isFormer);
    return calculateClassDuesSummary(active, feeStructures, transactions, cashierViewMonth).profiles;
  }, [cashierViewMonth, allDuesSummary, students, feeStructures, transactions]);

  const feeSearchProfiles = useMemo(() => {
    const q = feeSearchQuery.toLowerCase().trim();
    const all = viewFeeProfiles;
    if (!q) return all;
    return all.filter(p => {
      const st = p.student;
      return (
        (st.name && st.name.toLowerCase().includes(q)) ||
        (st.nameBn && st.nameBn.includes(q)) ||
        (st.roll && String(st.roll).includes(q)) ||
        (st.rollNumber && String(st.rollNumber).includes(q)) ||
        (st.studentId && String(st.studentId).toLowerCase().includes(q)) ||
        (st.guardianPhone && String(st.guardianPhone).includes(q)) ||
        (st.classLevel && st.classLevel.toLowerCase().includes(q))
      );
    });
  }, [viewFeeProfiles, feeSearchQuery]);

  const selectedFeeProfile = useMemo(() => {
    if (!feeStudentId) return null;
    return allDuesSummary.profiles.find(p => p.student.id === feeStudentId) || null;
  }, [allDuesSummary, feeStudentId]);

  const handleSelectFeeStudent = (profile: StudentDueProfile) => {
    setFeeStudentId(profile.student.id);
    setFeeAmount(profile.dueThisMonth > 0 ? String(profile.dueThisMonth) : '');
    setFeeRefNo('');
    setFeeNote('');
    setLastReceipt(null);
  };

  const handleCollectFee = async () => {
    if (!canCollectFees || !selectedFeeProfile || typeof addTransaction !== 'function') return;
    const st = selectedFeeProfile.student;
    const amount = Number(feeAmount) || 0;
    if (amount <= 0) return;

    const feeMonth = new Date().toISOString().slice(0, 7); // YYYY-MM — same key the dues service uses
    const todayStr = new Date().toISOString().split('T')[0];
    const collector = authUser?.displayName || currentMember?.displayName || currentUser?.name || '';

    // Same transaction shape + same AppContext addTransaction path as the
    // desktop StudentFeeCollection — no separate data path.
    const newTx: Omit<FinanceTransaction, 'id' | 'createdAt'> = {
      voucherNo: generateVoucherNo('INCOME', transactions),
      type: 'INCOME',
      category: 'STUDENT_TUITION',
      categoryName: isEn ? 'Student Fees' : 'ছাত্র ফি ও বেতন',
      fundType: 'GENERAL',
      amount,
      date: todayStr,
      paymentMethod: feeMethod,
      referenceNo: feeRefNo.trim() || undefined,
      studentId: st.id,
      studentCode: st.studentId,
      studentName: st.name,
      studentNameBn: st.nameBn,
      classLevel: st.classLevel,
      feeMonth,
      feeBreakdown: [{ name: 'Monthly Tuition', nameBn: 'মাসিক বেতন', amount }],
      payerOrPayee: st.guardianName ? `${st.guardianName} (অভিভাবক)` : (st.nameBn || st.name || ''),
      contactNo: st.guardianPhone || '',
      description: feeNote.trim() || `${feeMonth} মাসের ফি পরিশোধ`,
      collectedBy: collector
    };

    const created = addTransaction(newTx);
    const remaining = calculateSingleStudentDue(st, feeStructures, [...transactions, created]).dueThisMonth;
    // Truthful receipt (25 Oct 2026): the receipt is shown as fully saved
    // ONLY after the awaited cloud confirmation. On failure the receipt
    // still opens (the guardian needs the paper) but is marked local-only
    // with a retry action — never presented as deposited.
    const feeResult = await confirmFeeCloudSync([created, ...transactions], feeCloudFailureMessage(created.voucherNo));
    setLastReceipt({ tx: created, remainingDue: remaining, cloudConfirmed: feeResult.success });
    if (feeResult.success) {
      setFeeCloudFailure(null);
      setSaveSuccessNotice(isEn ? `✓ Receipt ${created.voucherNo} saved!` : `✓ রসিদ নং ${created.voucherNo} সংরক্ষিত হয়েছে!`);
      setTimeout(() => setSaveSuccessNotice(null), 3500);
    } else {
      setFeeCloudFailure(feeResult.message || feeCloudFailureMessage(created.voucherNo));
    }
  };

  // Retry re-confirms the still-local transactions (no re-collection).
  const retryFeeCloudSync = async () => {
    const result = await confirmFeeCloudSync();
    if (result.success && lastReceipt) {
      setLastReceipt({ ...lastReceipt, cloudConfirmed: true });
      setFeeCloudFailure(null);
      setSaveSuccessNotice(isEn ? `✓ Receipt ${lastReceipt.tx.voucherNo} saved!` : `✓ রসিদ নং ${lastReceipt.tx.voucherNo} সংরক্ষিত হয়েছে!`);
      setTimeout(() => setSaveSuccessNotice(null), 3500);
    }
  };

  // -------------------------------------------------------------
  // Shared chrome
  // -------------------------------------------------------------
  const brandCss = (
    <style>{`
      .brand-grad { background-image: linear-gradient(135deg, var(--color-brand), var(--color-brand-hover)) !important; }
      .brand-soft { background-color: var(--color-brand-light) !important; color: var(--color-brand) !important; }
      .brand-text { color: var(--color-brand) !important; }
      .brand-bg { background-color: var(--color-brand) !important; }
      @keyframes smFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .anim-stagger > * { animation: smFadeUp .45s cubic-bezier(.22,.8,.36,1) backwards; }
      .anim-stagger > *:nth-child(2) { animation-delay: .05s; }
      .anim-stagger > *:nth-child(3) { animation-delay: .1s; }
      .anim-stagger > *:nth-child(4) { animation-delay: .15s; }
      .anim-stagger > *:nth-child(5) { animation-delay: .2s; }
      .anim-stagger > *:nth-child(6) { animation-delay: .25s; }
      .anim-stagger > *:nth-child(7) { animation-delay: .3s; }
      html { scroll-behavior: smooth; }
    `}</style>
  );

  // Bottom nav — Tutor App pattern: white/95 blur bar, top border,
  // icon + label, active item in accent colour with a small dot below,
  // safe-area padding. The 5th tab is "More" (bottom sheet), not profile.
  const BottomNav = (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#161c2e]/95 backdrop-blur-xl border-t border-[#e8ecf4] dark:border-white/5 shadow-[0_-8px_24px_-12px_rgba(30,36,51,0.18)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {brandCss}
      <div className="grid grid-cols-5 h-[68px]">
        {bottomNavItems.map(item => {
          const Icon = item.icon;
          const isActive =
            (item.id === 'home' && !activeSubModule && !showProfile) ||
            (item.id === 'more' && moreActive) ||
            (item.targetModule !== null && item.targetModule === activeSubModule);
          return (
            <button
              key={item.id}
              onClick={() => handleBottomNavClick(item)}
              aria-label={item.label}
              className="relative flex flex-col items-center justify-center gap-1 min-h-[56px] cursor-pointer"
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.4 : 2}
                className={isActive ? 'brand-text' : 'text-[#8a93a8] dark:text-slate-500'}
              />
              <span className={`text-[11px] font-semibold leading-none ${isActive ? 'brand-text' : 'text-[#8a93a8] dark:text-slate-500'}`}>
                {item.label}
              </span>
              <span className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full brand-bg transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
              {/* Teacher dues tab: real count of students with dues in
                  the teacher's class (Tutor's Fees badge equivalent). */}
              {item.id === 'action2' && userRole === 'teacher' && classDuesSummary.dueStudentsCount > 0 && (
                <span className="absolute top-1 right-1/2 translate-x-5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#dc2626] text-white text-[10px] font-bold flex items-center justify-center">
                  {classDuesSummary.dueStudentsCount > 99 ? '99+' : toBn(classDuesSummary.dueStudentsCount)}
                </span>
              )}
              {/* More dot: shown only when a More-sheet tile carries a
                  real badge (unread notices) and More is not active. */}
              {item.id === 'more' && !moreActive && notices.length > 0 && (
                <span className="absolute top-2 right-1/2 translate-x-6 w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );

  // "More" bottom sheet — Tutor App pattern: translucent backdrop,
  // sheet slides up from the bottom, 2-column tile grid. Tiles only
  // open modules this role already uses (see moreItems).
  const MoreSheet = moreOpen && (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45"
      onClick={() => setMoreOpen(false)}
    >
      <div
        className="w-full max-h-[78vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-[#161c2e] border-t border-[#e8ecf4] dark:border-white/10 p-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="আরও"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black">আরও</h2>
          <button
            onClick={() => setMoreOpen(false)}
            aria-label="বন্ধ করুন"
            className="w-11 h-11 rounded-xl bg-[#f4f6fb] dark:bg-white/5 text-[#5b6478] dark:text-slate-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {moreItems.map(item => {
            const ItemIcon = item.icon;
            const isActive = item.id === 'leave' ? showLeave : (item.moduleKey !== null ? item.moduleKey === activeSubModule : showProfile);
            return (
              <button
                key={item.id}
                onClick={() => {
                  setMoreOpen(false);
                  if (item.id === 'leave') {
                    setActiveSubModule(null);
                    setShowLeave(true);
                  } else if (item.moduleKey === null) {
                    setActiveSubModule(null);
                    setShowProfile(true);
                  } else {
                    handleOpenModule(item.moduleKey);
                  }
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-3 p-3.5 rounded-2xl min-h-[60px] text-left cursor-pointer active:scale-[0.98] transition-all ${
                  isActive
                    ? 'brand-soft'
                    : 'bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10'
                }`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isActive
                    ? 'brand-grad text-white'
                    : 'bg-white dark:bg-[#161c2e] brand-text border border-[#e8ecf4] dark:border-white/10'
                }`}>
                  <ItemIcon size={19} />
                </span>
                <span className={`text-[13.5px] font-semibold flex-1 ${isActive ? 'brand-text' : ''}`}>
                  {item.label}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#dc2626] text-white text-[11px] font-bold flex items-center justify-center">
                    {item.badge > 99 ? '99+' : toBn(item.badge)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const successToast = saveSuccessNotice && (
    <div className="mx-4 mt-3 p-3 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[#065f46] dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
      <CheckCircle2 size={16} className="text-[#059669] shrink-0" />
      <span>{saveSuccessNotice}</span>
    </div>
  );

  // Truthful-save failure banner (25 Oct 2026): shown instead of the
  // success toast when the cloud confirmation fails. Local data is safe;
  // the retry button re-confirms it.
  const attendanceCloudFailureToast = attendanceCloudFailure && (
    <div className="mx-4 mt-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold flex flex-col gap-2">
      <span>{attendanceCloudFailure}</span>
      <button type="button" onClick={retryAttendanceCloudSync} className="self-start px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold">{RETRY_LABEL}</button>
    </div>
  );

  const classSwitcher = teacherClasses.length > 1 && (
    <div className="flex flex-wrap gap-1.5">
      {teacherClasses.map(clsName => (
        <button
          key={clsName}
          onClick={() => setSelectedClass(clsName)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            selectedClass === clsName
              ? 'brand-grad text-white shadow-md shadow-violet-500/25'
              : 'bg-[#f4f6fb] dark:bg-white/5 text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10'
          }`}
        >
          {clsName}
        </button>
      ))}
    </div>
  );

  // -------------------------------------------------------------
  // SUB-MODULE SCREENS
  // -------------------------------------------------------------
  if (activeSubModule) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] text-[#1e2433] dark:text-slate-100 flex flex-col pb-24">
        {/* Sticky header */}
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#161c2e]/95 backdrop-blur-xl border-b border-[#e8ecf4] dark:border-white/5 px-4 py-3 flex items-center justify-between">
          <button
            onClick={goHome}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 text-[#1e2433] dark:text-slate-200 text-xs font-bold cursor-pointer active:scale-95 transition-all"
          >
            <ArrowLeft size={15} />
            <span>হোম</span>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-[#1e2433] dark:text-white truncate max-w-[180px]">
              {userRole === 'teacher' ? selectedClass : roleTitleBengali[userRole]}
            </span>
            <span className="text-[10px] text-[#8a93a8]">{schoolProfile.nameBn || schoolProfile.name}</span>
          </div>
          <div className="w-9 h-9 rounded-full brand-grad text-white font-bold flex items-center justify-center text-sm shadow-md shadow-violet-500/25">
            {initialLetter}
          </div>
        </header>

        {successToast}
        {attendanceCloudFailureToast}

        <main className="flex-1 p-4 space-y-4 anim-stagger">
          <ServerDataGate dataNameBn="মডিউল তথ্য" dataNameEn="Module data">

          {/* ============ TEACHER: DAILY ATTENDANCE ============ */}
          {activeSubModule === 'teacher_attendance' && (
            <div className="space-y-4">
              {/* Title + class switcher (LDSDM's own — teacher scoping) */}
              <div className={`${attCardCls} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                      <CheckSquare size={17} />
                    </span>
                    <h2 className="text-sm font-bold">{isEn ? 'Daily attendance' : 'দৈনিক হাজিরা গ্রহণ'}</h2>
                  </div>
                  {selectedClass ? (
                    <span className="text-[11px] px-2.5 py-1 rounded-full brand-soft font-bold">
                      {selectedClass}
                    </span>
                  ) : null}
                </div>

                {classSwitcher}

                {/* No assigned class: honest empty state (never a wrong class's roster). */}
                {teacherClasses.length === 0 && (
                  <p className="text-[13px] font-semibold leading-relaxed text-[#dc2626] dark:text-rose-300">
                    {isEn
                      ? 'No class has been assigned to you yet — please contact the office.'
                      : 'আপনার জন্য এখনো কোনো ক্লাস নির্ধারণ করা হয়নি — অফিসে যোগাযোগ করুন।'}
                  </p>
                )}
              </div>

              {/* Tabs — Tutor pattern: page-bg bar, active tab = card + shadow + accent text */}
              <div className="flex gap-1 p-1 rounded-2xl bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setAttTab('rollcall')}
                  className={`flex-1 h-10 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer ${attTab === 'rollcall' ? 'bg-white dark:bg-[#161c2e] brand-text shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#5b6478] dark:text-slate-400'}`}
                >
                  <Users size={15} /> {isEn ? 'Roll call' : 'রোল কল'}
                </button>
                <button
                  type="button"
                  onClick={() => setAttTab('sheet')}
                  className={`flex-1 h-10 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer ${attTab === 'sheet' ? 'bg-white dark:bg-[#161c2e] brand-text shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#5b6478] dark:text-slate-400'}`}
                >
                  <CalendarDays size={15} /> {isEn ? 'Monthly sheet' : 'মাসিক শিট'}
                </button>
              </div>

              {attTab === 'rollcall' ? (
                <>
                  {/* Date card — Tutor pattern: nav row, hint, 5 counter chips */}
                  <div className={`${attCardCls} p-4 space-y-3`}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { const d = new Date(attendanceDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setAttendanceDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); }}
                        className="h-10 w-10 shrink-0 rounded-xl text-[14px] font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 cursor-pointer"
                      >
                        ‹
                      </button>
                      <input
                        type="date"
                        value={attendanceDate}
                        onChange={e => e.target.value && setAttendanceDate(e.target.value)}
                        className="h-10 px-3 rounded-xl text-[14px] font-semibold outline-none flex-1 min-w-0 bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 dark:[color-scheme:dark]"
                      />
                      <button
                        type="button"
                        onClick={() => { const d = new Date(attendanceDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setAttendanceDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); }}
                        className="h-10 w-10 shrink-0 rounded-xl text-[14px] font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 cursor-pointer"
                      >
                        ›
                      </button>
                    </div>

                    {!attendanceDayOff && (
                      <>
                        <p className="text-[12px] text-[#8a93a8] dark:text-slate-500">
                          {isEn ? 'Tap a status button to mark attendance' : 'স্ট্যাটাস বাটনে চাপ দিয়ে হাজিরা চিহ্নিত করুন'}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {([
                            { label: isEn ? 'Present' : 'উপস্থিত', value: attendanceStats.present, cls: 'text-[#10b981] dark:text-emerald-300' },
                            { label: isEn ? 'Late' : 'দেরি', value: attendanceStats.late, cls: 'text-[#d97706] dark:text-amber-300' },
                            { label: isEn ? 'Absent' : 'অনুপস্থিত', value: attendanceStats.absent, cls: 'text-[#dc2626] dark:text-rose-300' },
                            { label: isEn ? 'Leave' : 'ছুটি', value: attendanceStats.leave, cls: 'text-[#3b82f6] dark:text-blue-300' },
                            { label: isEn ? 'Unmarked' : 'চিহ্নিত নয়', value: attendanceStats.unmarked, cls: 'text-[#5b6478] dark:text-slate-400' },
                          ] as const).map(c => (
                            <div key={c.label} className="flex-1 min-w-[70px] rounded-xl px-2 py-2 text-center bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10">
                              <p className={`text-[15px] font-bold ${c.cls}`}>{toBn(c.value)}</p>
                              <p className="text-[11px] text-[#5b6478] dark:text-slate-400">{c.label}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {attendanceDayOff ? (
                    <div className="rounded-2xl p-5 shadow-sm space-y-3 bg-[#dbeafe] dark:bg-blue-500/10 border border-[#e8ecf4] dark:border-white/5">
                      <div className="flex items-center gap-2.5">
                        <CalendarDays size={18} className="shrink-0 text-[#3b82f6] dark:text-blue-300" />
                        <p className="font-bold text-[15px]">
                          {isEn ? 'Holiday' : 'আজ ছুটি'}{attendanceHoliday ? ` — ${attendanceHoliday.titleBn || attendanceHoliday.title}` : ''}
                        </p>
                      </div>
                      <p className="text-[13px] text-[#5b6478] dark:text-slate-400">
                        {isEn
                          ? `No attendance for ${selectedClass} today — the calendar marks it as a holiday.`
                          : `ক্যালেন্ডার অনুযায়ী আজ ${selectedClass}-এর ছুটির দিন, তাই হাজিরা নেওয়া যাবে না।`}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Roster header — Tutor pattern: count chip + tint buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 h-10 rounded-xl text-[13px] font-bold flex items-center gap-1.5 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10">
                          <Users size={15} className="brand-text" />
                          {toBn(classStudents.length)} {isEn ? 'students' : 'জন শিক্ষার্থী'}
                        </span>
                        <button
                          type="button"
                          onClick={handleMarkAllPresent}
                          disabled={classStudents.length === 0}
                          className="flex-1 min-w-[130px] h-10 rounded-xl text-[13px] font-bold disabled:opacity-50 bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 cursor-pointer"
                        >
                          ✓ {isEn ? 'ALL PRESENT' : 'সবাই উপস্থিত'}
                        </button>
                        <button
                          type="button"
                          onClick={handleMarkAllAbsent}
                          disabled={classStudents.length === 0}
                          className="flex-1 min-w-[130px] h-10 rounded-xl text-[13px] font-bold disabled:opacity-50 bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 cursor-pointer"
                        >
                          ✗ {isEn ? 'ALL ABSENT' : 'সবাই অনুপস্থিত'}
                        </button>
                        <button
                          type="button"
                          onClick={handleResetAttendance}
                          disabled={attendanceStats.takenCount === 0}
                          className="h-10 px-4 rounded-xl text-[13px] font-bold disabled:opacity-50 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 cursor-pointer"
                        >
                          {isEn ? 'Reset' : 'রিসেট'}
                        </button>
                      </div>

                      {/* Roster cards — Tutor pattern: big Present button + 3 below */}
                      {classStudents.length === 0 ? (
                        <div className={`${attCardCls} p-8 text-center space-y-2`}>
                          <Users size={32} className="mx-auto text-[#c3c9d9]" />
                          <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">{selectedClass}-{isEn ? ' no students found.' : 'এ কোনো শিক্ষার্থী পাওয়া যায়নি।'}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {classStudents.map(st => {
                            const currentStatus: AttendanceStatus = (studentAttendanceMap[st.id] as AttendanceStatus) || 'PRESENT';
                            const displayName = st.nameBn || st.name || '';
                            const tint = attAvatarTint(st.id);
                            const phone = (st.guardianPhone || '').trim();
                            const roll = st.roll || st.rollNumber || '';
                            const badgeCls = currentStatus === 'PRESENT'
                              ? 'bg-[#d1fae5] dark:bg-emerald-500/15 text-[#10b981] dark:text-emerald-300'
                              : currentStatus === 'ABSENT'
                                ? 'bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300'
                                : currentStatus === 'LATE'
                                  ? 'bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300'
                                  : 'bg-[#dbeafe] dark:bg-blue-500/15 text-[#3b82f6] dark:text-blue-300';
                            const badgeLabel = currentStatus === 'PRESENT'
                              ? (isEn ? 'Present' : 'উপস্থিত')
                              : currentStatus === 'ABSENT'
                                ? (isEn ? 'Absent' : 'অনুপস্থিত')
                                : currentStatus === 'LATE'
                                  ? (lateMinutesMap[st.id] ? `${isEn ? 'Late' : 'দেরি'} · ${toBn(lateMinutesMap[st.id])} ${isEn ? 'min' : 'মিনিট'}` : (isEn ? 'Late' : 'দেরি'))
                                  : (isEn ? 'Leave' : 'ছুটি');
                            const rosterBtn = (status: AttendanceStatus, label: string, solidCls: string, softCls: string) => (
                              <button
                                type="button"
                                onClick={() => status === 'LATE' ? handleLatePress(st.id) : handleSetStudentStatus(st.id, status)}
                                className={`h-12 rounded-xl text-[13px] font-bold cursor-pointer active:scale-[0.98] transition-all ${currentStatus === status ? solidCls : softCls}`}
                              >
                                {label}
                              </button>
                            );
                            return (
                              <div key={st.id} className={`${attCardCls} p-4 shadow-sm`}>
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0"
                                    style={{ background: tint.bg, color: tint.color }}
                                  >
                                    {attInitials(displayName)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[15px] truncate">{displayName}</p>
                                    <p className="flex items-center gap-1 text-[12px] mt-0.5 text-[#5b6478] dark:text-slate-400">
                                      <Phone size={12} className="shrink-0" />
                                      <span className="truncate">{phone ? toBn(phone) : '—'}{roll ? ` • ${isEn ? 'Roll' : 'রোল'}: ${toBn(roll)}` : ''}</span>
                                    </p>
                                  </div>
                                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${badgeCls}`}>
                                    {badgeLabel}
                                  </span>
                                </div>
                                <div className="mt-3 space-y-2">
                                  <div className="flex">
                                    {rosterBtn('PRESENT', isEn ? 'Present' : 'উপস্থিত', 'bg-[#10b981] text-white w-full', 'bg-[#d1fae5] dark:bg-emerald-500/15 text-[#10b981] dark:text-emerald-300 w-full')}
                                  </div>
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      {rosterBtn('ABSENT', isEn ? 'Absent' : 'অনুপস্থিত', 'bg-[#ef4444] text-white w-full', 'bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 w-full')}
                                    </div>
                                    <div className="flex-1">
                                      {rosterBtn('LATE', isEn ? 'Late' : 'দেরি', 'bg-[#f59e0b] text-white w-full', 'bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300 w-full')}
                                    </div>
                                    <div className="flex-1">
                                      {rosterBtn('LEAVE', isEn ? 'Leave' : 'ছুটি', 'bg-[#3b82f6] text-white w-full', 'bg-[#dbeafe] dark:bg-blue-500/15 text-[#3b82f6] dark:text-blue-300 w-full')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Save bar — KEPT (LDSDM's own flow: save defaults unmarked to PRESENT) */}
                      {classStudents.length > 0 && (
                        <div className="sticky bottom-[84px] z-30 pt-1">
                          <button
                            onClick={handleSaveAttendance}
                            className="w-full py-3.5 px-4 rounded-[20px] brand-grad text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-violet-500/30 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Save size={17} />
                            <span>{isEn ? 'Save attendance' : 'হাজিরা সংরক্ষণ করুন'}</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {/* Print + month stepper — Tutor placement: print row, stepper centered */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        disabled={classStudents.length === 0}
                        className="flex-1 h-11 px-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 text-white whitespace-nowrap disabled:opacity-50 brand-grad cursor-pointer"
                      >
                        <Printer size={16} /> {isEn ? 'Print' : 'প্রিন্ট'}
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => { const y = Number(sheetMonth.slice(0, 4)); const mi = Number(sheetMonth.slice(5, 7)) - 2; const d = new Date(y, mi, 1); setSheetMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }}
                        className="h-11 w-11 shrink-0 rounded-xl text-[14px] font-bold bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 cursor-pointer"
                      >
                        ‹
                      </button>
                      <input
                        type="month"
                        value={sheetMonth}
                        onChange={e => e.target.value && setSheetMonth(e.target.value)}
                        className="h-11 px-3 rounded-xl text-[14px] font-semibold outline-none min-w-0 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 dark:[color-scheme:dark]"
                      />
                      <button
                        type="button"
                        onClick={() => { const y = Number(sheetMonth.slice(0, 4)); const mi = Number(sheetMonth.slice(5, 7)); const d = new Date(y, mi, 1); setSheetMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }}
                        className="h-11 w-11 shrink-0 rounded-xl text-[14px] font-bold bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 cursor-pointer"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  {/* View toggle — Tutor pill */}
                  <div className="flex rounded-full p-1 gap-1 brand-soft">
                    {([
                      { key: 'cards' as const, label: isEn ? 'Cards' : 'কার্ড' },
                      { key: 'grid' as const, label: isEn ? 'Grid' : 'গ্রিড' },
                    ]).map(opt => {
                      const active = sheetView === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSheetView(opt.key)}
                          className={`flex-1 text-[12px] px-2.5 py-1.5 rounded-full transition-colors cursor-pointer ${active ? 'bg-white dark:bg-[#161c2e] text-[#1e2433] dark:text-white font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-transparent text-[#8a93a8] dark:text-slate-500 font-medium'}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Sheet card — Tutor header + views */}
                  <div className="rounded-2xl shadow-sm overflow-hidden bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/5">
                    <div className="p-5 text-center border-b border-[#e8ecf4] dark:border-white/5">
                      <p className="text-[12px] font-semibold uppercase tracking-wide brand-text">
                        {isEn ? 'Monthly attendance sheet' : 'মাসিক হাজিরা শিট'}
                      </p>
                      <h2 className="text-[18px] font-bold mt-1">{selectedClass}</h2>
                      <p className="text-[12px] mt-0.5 text-[#5b6478] dark:text-slate-400">
                        {isEn
                          ? `${EN_MONTHS[Number(sheetMonth.slice(5, 7)) - 1] || ''} ${sheetMonth.slice(0, 4)}`
                          : bnMonthLabel(sheetMonth)}
                      </p>
                    </div>

                    {classStudents.length === 0 ? (
                      <p className="p-8 text-center text-[13px] text-[#5b6478] dark:text-slate-400">
                        {selectedClass}-{isEn ? ' no students found.' : 'এ কোনো শিক্ষার্থী পাওয়া যায়নি।'}
                      </p>
                    ) : sheetView === 'grid' ? (
                      <div className="overflow-auto" style={{ maxHeight: 'min(70vh, 560px)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
                        <table className="w-full text-[12px] border-collapse">
                          <thead>
                            <tr>
                              <th className="px-3 py-2.5 text-left font-bold sticky left-0 top-0 z-30 min-w-[140px] bg-[#f4f6fb] dark:bg-[#161c2e]">
                                {isEn ? 'Name' : 'নাম'}
                              </th>
                              {sheetDays.map(d => {
                                const wd = new Date(Number(sheetMonth.slice(0, 4)), Number(sheetMonth.slice(5, 7)) - 1, d.day).getDay();
                                const isToday = d.dateStr === new Date().toISOString().split('T')[0];
                                return (
                                  <th
                                    key={d.dateStr}
                                    title={d.holiday || (d.isFriday ? (isEn ? 'Weekly holiday (Friday)' : 'সাপ্তাহিক ছুটি (শুক্রবার)') : d.dateStr)}
                                    className={`px-1 py-2 text-center font-bold sticky top-0 z-20 min-w-[36px] ${isToday ? 'bg-[#ede9fe] dark:bg-violet-500/15 brand-text' : 'bg-[#f4f6fb] dark:bg-[#161c2e] text-[#5b6478] dark:text-slate-400'}`}
                                  >
                                    <span className="block text-[12px]">{toBn(d.day)}</span>
                                    <span className="block text-[10px] font-semibold opacity-70">
                                      {(isEn ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'])[wd]}
                                    </span>
                                  </th>
                                );
                              })}
                              <th className="px-2 py-2.5 text-center font-bold sticky right-0 top-0 z-30 min-w-[76px] bg-[#f4f6fb] dark:bg-[#161c2e] text-[#5b6478] dark:text-slate-400">
                                {isEn ? 'Present/Total' : 'উপস্থিত/মোট'}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {classStudents.map(st => {
                              const recs = sheetByStudent.get(st.id);
                              const s = getStudentMonthlySummaryFromRecords(dailyStudentAttendance, st.id, Number(sheetMonth.slice(0, 4)), Number(sheetMonth.slice(5, 7)));
                              return (
                                <tr key={st.id} className="border-t border-[#e8ecf4] dark:border-white/5">
                                  <td className="px-3 py-2 font-semibold sticky left-0 z-10 max-w-[140px] truncate bg-white dark:bg-[#161c2e]">
                                    {st.nameBn || st.name}
                                  </td>
                                  {sheetDays.map(d => {
                                    const rec = recs?.get(d.dateStr);
                                    const sym = rec
                                      ? (rec.status === 'PRESENT' ? '✓' : rec.status === 'LATE' ? (isEn ? 'L' : 'দে') : rec.status === 'ABSENT' ? '✗' : (isEn ? 'LV' : 'ছ'))
                                      : (d.holiday ? (isEn ? 'H' : 'ছু') : d.isFriday ? (isEn ? 'F' : 'শু') : '–');
                                    const chipCls = rec
                                      ? (rec.status === 'PRESENT' ? 'bg-[#d1fae5] dark:bg-emerald-500/15 text-[#10b981] dark:text-emerald-300'
                                        : rec.status === 'LATE' ? 'bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300'
                                        : rec.status === 'ABSENT' ? 'bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300'
                                        : 'bg-[#dbeafe] dark:bg-blue-500/15 text-[#3b82f6] dark:text-blue-300')
                                      : (d.holiday ? 'bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300'
                                        : d.isFriday ? 'bg-[#f4f6fb] dark:bg-white/5 text-[#8a93a8] dark:text-slate-500'
                                        : 'text-[#c3c9d9] dark:text-slate-600');
                                    return (
                                      <td key={d.dateStr} className="px-1 py-2 text-center">
                                        <span
                                          className={`inline-flex w-8 h-8 items-center justify-center rounded-lg text-[12px] font-bold ${chipCls}`}
                                          title={rec && rec.status === 'LATE' && rec.lateMinutes ? `${isEn ? 'Late' : 'দেরি'} ${toBn(rec.lateMinutes)} ${isEn ? 'min' : 'মিনিট'}` : (d.holiday || undefined)}
                                        >
                                          {sym}
                                        </span>
                                      </td>
                                    );
                                  })}
                                  <td className="px-2 py-2 text-center sticky right-0 z-10 bg-white dark:bg-[#161c2e]">
                                    <span className="block text-[12px] font-bold">{toBn(s.presentDays)}/{toBn(s.workingDays)}</span>
                                    <span className="block text-[10px] text-[#5b6478] dark:text-slate-400">{toBn(s.percentage)}%</span>
                                    {s.leaveDays > 0 && (
                                      <span className="block text-[10px] font-semibold text-[#3b82f6] dark:text-blue-300">
                                        {isEn ? 'Leave' : 'ছুটি'} {toBn(s.leaveDays)}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="space-y-3 pb-3">
                        <div className="grid grid-cols-7 gap-1 px-3.5 pt-3">
                          {[6, 0, 1, 2, 3, 4, 5].map(i => (
                            <span key={i} className="text-center text-[11px] font-bold text-[#8a93a8] dark:text-slate-500">
                              {(isEn ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'])[i]}
                            </span>
                          ))}
                        </div>
                        {classStudents.map(st => {
                          const s = getStudentMonthlySummaryFromRecords(dailyStudentAttendance, st.id, Number(sheetMonth.slice(0, 4)), Number(sheetMonth.slice(5, 7)));
                          const recs = sheetByStudent.get(st.id);
                          const studentMonthRecs: DailyStudentAttendanceRecord[] = recs ? Array.from(recs.values()) : [];
                          const lateTotal = studentMonthRecs.reduce((sum, r) => sum + (r.status === 'LATE' ? (r.lateMinutes || 0) : 0), 0);
                          const displayName = st.nameBn || st.name || '';
                          const leadingBlanks = (new Date(Number(sheetMonth.slice(0, 4)), Number(sheetMonth.slice(5, 7)) - 1, 1).getDay() + 1) % 7;
                          return (
                            <div key={st.id} className="rounded-2xl p-3.5 shadow-sm bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/5 mx-3">
                              <div className="flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-[15px] font-bold shrink-0 brand-soft">
                                  {displayName.trim().charAt(0).toUpperCase()}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-[14px] truncate">{displayName}</p>
                                  <p className="text-[12px] text-[#5b6478] dark:text-slate-400">
                                    {toBn(s.presentDays)}/{toBn(s.workingDays)} • {toBn(s.percentage)}%
                                    {s.leaveDays > 0 ? ` • ${isEn ? 'Leave' : 'ছুটি'} ${toBn(s.leaveDays)}` : ''}
                                    {lateTotal > 0 ? ` • ${isEn ? 'Total late' : 'মোট দেরি'} ${toBn(lateTotal)} ${isEn ? 'min' : 'মিনিট'}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-1.5 mt-3 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-[#d1fae5] dark:bg-emerald-500/15 text-[#10b981] dark:text-emerald-300">
                                  ✓ {toBn(s.presentDays)}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300">
                                  {isEn ? 'L' : 'দে'} {toBn(s.lateDays)}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300">
                                  ✗ {toBn(s.absentDays)}
                                </span>
                                {s.leaveDays > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-[#dbeafe] dark:bg-blue-500/15 text-[#3b82f6] dark:text-blue-300">
                                    {isEn ? 'Leave' : 'ছুটি'} {toBn(s.leaveDays)}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-7 gap-1 mt-3">
                                {Array.from({ length: leadingBlanks }).map((_, i) => (
                                  <span key={`b${i}`} />
                                ))}
                                {sheetDays.map(d => {
                                  const rec = recs?.get(d.dateStr);
                                  const isToday = d.dateStr === new Date().toISOString().split('T')[0];
                                  const cellBg = rec
                                    ? (rec.status === 'PRESENT' ? 'bg-[#d1fae5] dark:bg-emerald-500/15'
                                      : rec.status === 'LATE' ? 'bg-[#fef3c7] dark:bg-amber-500/15'
                                      : rec.status === 'ABSENT' ? 'bg-[#fee2e2] dark:bg-rose-500/15'
                                      : 'bg-[#dbeafe] dark:bg-blue-500/15')
                                    : (d.holiday ? 'bg-[#fef3c7] dark:bg-amber-500/15' : '');
                                  const cellText = rec
                                    ? (rec.status === 'PRESENT' ? 'text-[#10b981] dark:text-emerald-300'
                                      : rec.status === 'LATE' ? 'text-[#d97706] dark:text-amber-300'
                                      : rec.status === 'ABSENT' ? 'text-[#dc2626] dark:text-rose-300'
                                      : 'text-[#3b82f6] dark:text-blue-300')
                                    : (d.holiday ? 'text-[#d97706] dark:text-amber-300' : d.isFriday ? 'text-[#8a93a8] dark:text-slate-500' : 'text-[#8a93a8] dark:text-slate-500');
                                  const sym = rec
                                    ? (rec.status === 'PRESENT' ? '✓' : rec.status === 'LATE' ? (isEn ? 'L' : 'দে') : rec.status === 'ABSENT' ? '✗' : (isEn ? 'LV' : 'ছ'))
                                    : (d.holiday ? (isEn ? 'H' : 'ছু') : d.isFriday ? (isEn ? 'F' : 'শু') : '');
                                  return (
                                    <div
                                      key={d.dateStr}
                                      className={`h-[38px] rounded-lg flex flex-col items-center justify-center ${cellBg} ${cellText} ${isToday ? 'border-[1.5px] border-[color:var(--color-brand)]' : 'border-[1.5px] border-transparent'}`}
                                      title={rec && rec.status === 'LATE' && rec.lateMinutes ? `${isEn ? 'Late' : 'দেরি'} ${toBn(rec.lateMinutes)} ${isEn ? 'min' : 'মিনিট'}` : (d.holiday || undefined)}
                                    >
                                      <span className="text-[12px] font-bold leading-none">{toBn(d.day)}</span>
                                      <span className="text-[10px] font-bold leading-none mt-0.5">{sym}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Legend — Tutor chip row, symbols matched to this sheet's cells */}
                  <div className="flex items-center gap-4 flex-wrap text-[12px] text-[#5b6478] dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md inline-flex items-center justify-center text-[11px] font-bold bg-[#d1fae5] dark:bg-emerald-500/15 text-[#10b981] dark:text-emerald-300">✓</span>
                      {isEn ? 'Present' : 'উপস্থিত'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md inline-flex items-center justify-center text-[11px] font-bold bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300">{isEn ? 'L' : 'দে'}</span>
                      {isEn ? 'Late' : 'দেরি'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md inline-flex items-center justify-center text-[11px] font-bold bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300">✗</span>
                      {isEn ? 'Absent' : 'অনুপস্থিত'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md inline-flex items-center justify-center text-[11px] font-bold bg-[#dbeafe] dark:bg-blue-500/15 text-[#3b82f6] dark:text-blue-300">{isEn ? 'LV' : 'ছ'}</span>
                      {isEn ? 'Leave' : 'ছুটি'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md inline-flex items-center justify-center text-[11px] font-bold bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300">{isEn ? 'H' : 'ছু'}</span>
                      {isEn ? 'Calendar holiday' : 'ক্যালেন্ডার ছুটি'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md inline-flex items-center justify-center text-[11px] font-bold bg-[#f4f6fb] dark:bg-white/5 text-[#8a93a8] dark:text-slate-500">{isEn ? 'F' : 'শু'}</span>
                      {isEn ? 'Weekly holiday' : 'সাপ্তাহিক ছুটি'}
                    </span>
                  </div>
                </div>
              )}

              {/* Late picker — Tutor's drum-wheel sheet (ModalShell pattern) */}
              {latePicker && (() => {
                const pickerStudent = classStudents.find(s => s.id === latePicker.studentId);
                const pickerName = pickerStudent?.nameBn || pickerStudent?.name || '';
                const total = latePicker.hours * 60 + latePicker.minutes;
                const mm = String(latePicker.minutes).padStart(2, '0');
                const tint = attAvatarTint(latePicker.studentId);
                return (
                  <div
                    className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
                    style={{ background: 'rgba(15, 20, 35, 0.45)' }}
                    onClick={() => setLatePicker(null)}
                  >
                    <div
                      className="w-full sm:max-w-[440px] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl shadow-xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10"
                      onClick={e => e.stopPropagation()}
                      role="dialog"
                      aria-modal="true"
                    >
                      <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-3">
                        <h2 className="text-[17px] font-bold">{pickerName}</h2>
                        <button
                          type="button"
                          onClick={() => setLatePicker(null)}
                          aria-label={isEn ? 'Cancel' : 'বাতিল'}
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#f4f6fb] dark:bg-white/5 text-[#5b6478] dark:text-slate-400 cursor-pointer"
                        >
                          <X size={17} />
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6 pb-4">
                        <style>{'.late-wheel-scroll::-webkit-scrollbar{display:none}'}</style>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0"
                              style={{ background: tint.bg, color: tint.color }}
                            >
                              {attInitials(pickerName)}
                            </div>
                            <p className="text-[15px] font-bold">
                              {pickerName} {isEn ? 'was late by how much?' : 'কতক্ষণ দেরি করেছে?'}
                            </p>
                          </div>
                          <div className="rounded-2xl py-3 px-4 text-center bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10">
                            <p className="text-[38px] leading-none font-extrabold tabular-nums text-[#d97706] dark:text-amber-300" aria-live="polite">
                              {toBn(latePicker.hours)}:{toBn(mm)}
                            </p>
                            <p className="mt-1.5 text-[13px] font-semibold text-[#5b6478] dark:text-slate-400">
                              {toBn(latePicker.hours)} {isEn ? 'hr' : 'ঘণ্টা'} {toBn(latePicker.minutes)} {isEn ? 'min' : 'মিনিট'}
                            </p>
                          </div>
                          <div>
                            <div className="flex gap-2 mb-1">
                              <p className="flex-1 text-center text-[12px] font-bold text-[#5b6478] dark:text-slate-400">
                                {isEn ? 'Hours' : 'ঘণ্টা'}
                              </p>
                              <p className="flex-1 text-center text-[12px] font-bold text-[#5b6478] dark:text-slate-400">
                                {isEn ? 'Minutes' : 'মিনিট'}
                              </p>
                            </div>
                            <div className="relative">
                              <div
                                aria-hidden="true"
                                className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none rounded-xl bg-[#fef3c7] dark:bg-amber-500/15 border-y border-[#e8ecf4] dark:border-white/10"
                                style={{ height: 46 }}
                              />
                              <div
                                className="relative flex gap-2"
                                style={{ maskImage: WHEEL_FADE, WebkitMaskImage: WHEEL_FADE }}
                              >
                                <WheelColumn
                                  values={LATE_HOURS}
                                  value={latePicker.hours}
                                  onChange={v => setLatePicker(p => p ? { ...p, hours: v } : p)}
                                  format={v => toBn(v)}
                                  ariaLabel={isEn ? 'Hours' : 'ঘণ্টা'}
                                />
                                <WheelColumn
                                  values={LATE_MINUTE_VALUES}
                                  value={latePicker.minutes}
                                  onChange={v => setLatePicker(p => p ? { ...p, minutes: v } : p)}
                                  format={v => toBn(String(v).padStart(2, '0'))}
                                  ariaLabel={isEn ? 'Minutes' : 'মিনিট'}
                                />
                              </div>
                            </div>
                          </div>
                          {total === 0 && (
                            <p className="text-center text-[12px] font-bold text-[#dc2626] dark:text-rose-300">
                              {isEn ? 'Pick at least 1 minute' : 'কমপক্ষে ১ মিনিট বেছে নিন'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div
                        className="shrink-0 px-5 sm:px-6 pt-3 rounded-b-3xl bg-white dark:bg-[#161c2e] border-t border-[#e8ecf4] dark:border-white/10"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
                      >
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setLatePicker(null)}
                            className="flex-1 h-12 rounded-xl text-[14px] font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 cursor-pointer"
                          >
                            {isEn ? 'Cancel' : 'বাতিল'}
                          </button>
                          <button
                            type="button"
                            disabled={total === 0}
                            onClick={handleLateConfirm}
                            className="flex-1 h-12 rounded-xl text-[14px] font-bold text-white disabled:opacity-50 bg-[#f59e0b] cursor-pointer"
                          >
                            {isEn ? 'Save' : 'সংরক্ষণ করুন'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ============ TEACHER: STUDENTS & DUES ============ */}
          {activeSubModule === 'teacher_students_dues' && (
            <div className="space-y-4">
              <div className={`${cardCls} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-2xl bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 flex items-center justify-center">
                      <DollarSign size={17} />
                    </span>
                    <h2 className="text-sm font-bold">শ্রেণির বকেয়া খতিয়ান</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full brand-soft font-bold">{selectedClass}</span>
                </div>

                {classSwitcher}

                <div className="grid grid-cols-2 gap-2">
                  <div className={`${softBg} p-3 rounded-2xl`}>
                    <span className="text-[11px] text-[#5b6478] dark:text-slate-400 font-medium block">মোট শিক্ষার্থী</span>
                    <span className="text-lg font-black">{toBn(viewDuesSummary.totalStudents)} জন</span>
                  </div>
                  <div className="bg-[#fee2e2] dark:bg-rose-500/10 p-3 rounded-2xl">
                    <span className="text-[11px] text-[#dc2626] font-medium block">মোট বকেয়া ফি</span>
                    <span className="text-lg font-black text-[#dc2626] dark:text-rose-300">৳{toBn(viewDuesSummary.totalDue.toLocaleString())}</span>
                  </div>
                  <div className={`${softBg} p-3 rounded-2xl`}>
                    <span className="text-[11px] text-[#5b6478] dark:text-slate-400 font-medium block">বকেয়া রয়েছে</span>
                    <span className="text-sm font-bold text-[#dc2626] dark:text-rose-300">{toBn(viewDuesSummary.dueStudentsCount)} জন</span>
                  </div>
                  <div className={`${softBg} p-3 rounded-2xl`}>
                    <span className="text-[11px] text-[#5b6478] dark:text-slate-400 font-medium block">পরিশোধিত</span>
                    <span className="text-sm font-bold text-[#059669] dark:text-emerald-300">{toBn(viewDuesSummary.paidStudentsCount)} জন</span>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-1 rounded-[24px] bg-[#fee2e2] dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 shadow-[0_2px_12px_rgba(30,36,51,0.05)]">
                <span className="text-[11px] font-bold text-[#dc2626] dark:text-rose-300 block">মোট বকেয়া (সব মাস মিলিয়ে)</span>
                <span className="text-2xl font-black text-[#991b1b] dark:text-rose-200">৳{toBn((classDuesSummary.totalDue + teacherAging.totalAged).toLocaleString())}</span>
                <p className="text-[11px] text-[#dc2626]/80 dark:text-rose-300/80 font-medium">
                  চলতি মাস ৳{toBn(classDuesSummary.totalDue.toLocaleString())} + পুরনো ৳{toBn(teacherAging.totalAged.toLocaleString())} (১ মাস আগের ৳{toBn(teacherAging.oneMonthOld.toLocaleString())} • ২+ মাস আগের ৳{toBn(teacherAging.twoPlus.toLocaleString())})
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#5b6478] dark:text-slate-400 shrink-0">ফি মাস:</span>
                  <select
                    value={duesViewMonth}
                    onChange={e => setDuesViewMonth(e.target.value)}
                    className="flex-1 py-3 px-3 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
                  >
                    {feeMonthOptions.map(m => (
                      <option key={m} value={m}>{bnMonthLabel(m)}{m === currentMonthStr ? ' (চলতি)' : ''}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleCopyAllNumbers(filteredDuesProfiles)}
                    className="px-3.5 py-3 rounded-2xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 text-xs font-bold cursor-pointer active:scale-95 shrink-0"
                  >
                    {copiedAllNumbers ? 'কপি হয়েছে ✓' : 'সব নম্বর কপি'}
                  </button>
                </div>
                {duesViewMonth !== currentMonthStr && (
                  <p className="text-[11px] text-[#8a93a8] font-medium px-1">
                    দেখছেন: {bnMonthLabel(duesViewMonth)} মাসের হিসাব — পুরনো মাসের ধার্য বর্তমান ক্লাস-ফি দিয়ে হিসাব করা হয়েছে।
                  </p>
                )}
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a93a8]" />
                  <input
                    type="text"
                    value={duesSearchQuery}
                    onChange={e => setDuesSearchQuery(e.target.value)}
                    placeholder="রোল, নাম বা মোবাইল দিয়ে খুঁজুন..."
                    className="w-full pl-10 pr-3 py-3 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-xs font-medium placeholder:text-[#8a93a8] focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {([
                    ['ALL', `সবাই (${toBn(viewDuesSummary.totalStudents)})`],
                    ['DUE_ONLY', `শুধু বকেয়া (${toBn(viewDuesSummary.dueStudentsCount)})`],
                    ['PAID_ONLY', `পরিশোধিত (${toBn(viewDuesSummary.paidStudentsCount)})`]
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setDuesFilterMode(mode)}
                      className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        duesFilterMode === mode
                          ? 'brand-grad text-white shadow-md shadow-violet-500/25'
                          : 'bg-white dark:bg-[#161c2e] text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredDuesProfiles.length === 0 ? (
                  <div className={`${cardCls} p-8 text-center space-y-2`}>
                    <CheckCircle2 size={32} className="mx-auto text-[#10b981]" />
                    {duesFilterMode === 'DUE_ONLY' ? (
                      <>
                        <p className="text-sm font-black text-[#059669] dark:text-emerald-300">সব ফি আদায় হয়েছে!</p>
                        <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">এই তালিকায় কারো বকেয়া নেই।</p>
                      </>
                    ) : (
                      <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।</p>
                    )}
                  </div>
                ) : (
                  filteredDuesProfiles.map(p => {
                    const st = p.student;
                    const hasDue = p.dueThisMonth > 0;
                    const phone = st.guardianPhone;
                    const wa = hasDue ? whatsappLink(p) : null;
                    const aging = agingByStudent.get(st.id);
                    const agedTotal = aging?.totalAged || 0;
                    const agedWa = agedTotal > 0 ? agedWhatsappLink(st, agedTotal) : null;
                    return (
                      <div key={st.id} className={`${cardCls} p-4 flex flex-col gap-3`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full brand-grad text-white font-bold flex items-center justify-center text-sm shadow-md shadow-violet-500/20 shrink-0">
                              {(st.nameBn || st.name || 'শ').charAt(0)}
                            </span>
                            <div>
                              <h3 className="text-[13px] font-bold leading-tight">{st.nameBn || st.name}</h3>
                              <p className="text-[11px] text-[#8a93a8]">রোল: {toBn(st.roll || st.rollNumber || '—')} • পিতা: {st.fatherNameBn || st.fatherName || '—'}</p>
                            </div>
                          </div>
                          <span className={`text-[11px] font-black px-2.5 py-1.5 rounded-xl shrink-0 ${
                            hasDue ? 'bg-[#fee2e2] text-[#991b1b] dark:bg-rose-500/15 dark:text-rose-300' : 'bg-[#d1fae5] text-[#065f46] dark:bg-emerald-500/15 dark:text-emerald-300'
                          }`}>
                            {hasDue ? `বকেয়া ৳${toBn(p.dueThisMonth.toLocaleString())}` : 'পরিশোধিত ✓'}
                          </span>
                        </div>

                        <div className={`grid grid-cols-2 gap-2 p-2.5 rounded-2xl ${softBg} text-[11px]`}>
                          <div>
                            <span className="text-[#8a93a8]">মাসিক ধার্য: </span>
                            <span className="font-bold">৳{toBn(p.monthlyExpected.toLocaleString())}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[#8a93a8]">পরিশোধিত: </span>
                            <span className="font-bold text-[#059669] dark:text-emerald-300">৳{toBn(p.paidThisMonth.toLocaleString())}</span>
                          </div>
                        </div>
                        {agedTotal > 0 && aging && (
                          <p className="text-[11px] font-semibold text-[#d97706] dark:text-amber-300">
                            এর মধ্যে পুরনো বকেয়া: ৳{toBn(agedTotal.toLocaleString())} (১ মাস আগের ৳{toBn(aging.oneMonthOld.toLocaleString())} • ২+ মাস আগের ৳{toBn(aging.twoPlusMonthsOld.toLocaleString())})
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-[#5b6478] dark:text-slate-300 min-w-0">
                            <Phone size={13} className="text-[#7c3aed] shrink-0" />
                            <span className="font-semibold text-[11px] truncate">{phone ? toBn(phone) : 'ফোন নম্বর নেই'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {phone && (
                              <a href={`tel:${phone}`} className="px-2.5 py-1.5 rounded-xl bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 text-[11px] font-bold flex items-center gap-1">
                                <Phone size={11} /> কল
                              </a>
                            )}
                            {hasDue && wa && (
                              <a href={wa} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-xl bg-[#10b981] text-white text-[11px] font-bold flex items-center gap-1 shadow-md shadow-emerald-500/25">
                                <MessageCircle size={11} /> WhatsApp
                              </a>
                            )}
                            {agedWa && (
                              <a href={agedWa} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-xl bg-[#f59e0b] text-white text-[11px] font-bold flex items-center gap-1 shadow-md shadow-amber-500/25">
                                <MessageCircle size={11} /> পুরনো WhatsApp
                              </a>
                            )}
                            {hasDue && (
                              <button
                                type="button"
                                onClick={() => handleCopySms(p)}
                                className="px-2.5 py-1.5 rounded-xl brand-soft text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                {copiedStudentId === st.id ? (<><Check size={11} /> কপি হয়েছে</>) : (<><Copy size={11} /> তাগাদা</>)}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ============ TEACHER: MARKS ENTRY ============ */}
          {activeSubModule === 'teacher_marks' && (
            <div className="space-y-4">
              {!canEnterMarks && (
                <div className="p-4 rounded-[24px] bg-[#fef3c7] dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex items-start gap-3">
                  <span className="w-9 h-9 rounded-2xl bg-[#f59e0b] text-white flex items-center justify-center shrink-0">
                    <Lock size={16} />
                  </span>
                  <div>
                    <h3 className="text-[13px] font-bold text-[#92400e] dark:text-amber-200">{isEn ? 'Marks entry is closed' : 'নম্বর এন্ট্রি বর্তমানে বন্ধ আছে'}</h3>
                    <p className="text-[11px] text-[#92400e]/80 dark:text-amber-200/70 mt-0.5 leading-relaxed">
                      {isEn
                        ? 'The admin has not enabled marks entry for your role right now. You can only view the entered marks below.'
                        : 'এডমিন এখন আপনার রোলের জন্য নম্বর এন্ট্রির অনুমতি চালু রাখেননি। নিচে শুধু আগের দেওয়া নম্বর দেখতে পারবেন। এন্ট্রি চালু করতে প্রিন্সিপাল/এডমিনের সাথে যোগাযোগ করুন।'}
                    </p>
                  </div>
                </div>
              )}
              <div className={`${cardCls} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-2xl brand-soft flex items-center justify-center">
                      <PenTool size={17} />
                    </span>
                    <h2 className="text-sm font-bold">{canEnterMarks ? (isEn ? 'Marks Entry' : 'নম্বর এন্ট্রি') : (isEn ? 'View Marks' : 'নম্বর দেখুন')}</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full brand-soft font-bold">{selectedClass}</span>
                </div>

                {classSwitcher}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-[#8a93a8] font-semibold block mb-1">পরীক্ষা</label>
                    <select
                      value={selectedExamId}
                      onChange={e => setSelectedExamId(e.target.value)}
                      className={`w-full ${softBg} border border-[#e8ecf4] dark:border-white/10 rounded-2xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400 dark:[color-scheme:dark]`}
                    >
                      {exams.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#8a93a8] font-semibold block mb-1">বিষয়</label>
                    <select
                      value={selectedSubjectId}
                      onChange={e => setSelectedSubjectId(e.target.value)}
                      className={`w-full ${softBg} border border-[#e8ecf4] dark:border-white/10 rounded-2xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400 dark:[color-scheme:dark]`}
                    >
                      {classSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.nameBn || s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#5b6478] dark:text-slate-400">শিক্ষার্থী ({toBn(classStudents.length)} জন)</span>
                  <span className="text-[11px] text-[#8a93a8]">পূর্ণমান: {toBn(100)}</span>
                </div>

                {classStudents.map(st => {
                  const currentVal = marksInputMap[st.id] ?? '';
                  const numVal = Number(currentVal);
                  const grade = currentVal !== ''
                    ? (numVal >= 80 ? 'A+' : numVal >= 70 ? 'A' : numVal >= 60 ? 'A-' : numVal >= 50 ? 'B' : numVal >= 40 ? 'C' : numVal >= 33 ? 'D' : 'F')
                    : '—';
                  return (
                    <div key={st.id} className={`${cardCls} p-3.5 flex items-center justify-between gap-3`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="w-10 h-10 rounded-full brand-grad text-white font-bold flex items-center justify-center text-sm shadow-md shadow-violet-500/20 shrink-0">
                          {(st.nameBn || st.name || 'শ').charAt(0)}
                        </span>
                        <div className="overflow-hidden">
                          <h3 className="text-[13px] font-bold truncate">{st.nameBn || st.name}</h3>
                          <span className="text-[11px] text-[#8a93a8]">
                            রোল {toBn(st.roll || st.rollNumber || '—')} • গ্রেড: <strong className={grade === 'F' ? 'text-[#dc2626]' : 'text-[#059669]'}>{grade}</strong>
                          </span>
                        </div>
                      </div>
                      {canEnterMarks ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          inputMode="numeric"
                          value={currentVal}
                          onChange={e => setMarksInputMap(prev => ({ ...prev, [st.id]: e.target.value }))}
                          placeholder="০"
                          className="w-[72px] py-2.5 px-2 bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-center text-sm font-black focus:outline-none focus:ring-2 focus:ring-violet-400 shrink-0"
                        />
                      ) : (
                        <div className="w-[72px] py-2.5 px-2 bg-[#f4f6fb] dark:bg-white/5 border border-dashed border-[#e8ecf4] dark:border-white/10 rounded-2xl text-center text-sm font-black text-[#5b6478] dark:text-slate-300 shrink-0">
                          {currentVal !== '' ? toBn(currentVal) : '—'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Truthful-save failure banner (Step 2): marks stay local until a retry confirms the cloud write. */}
              {marksCloudFailure && (
                <div className="mx-1 mt-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold flex flex-col gap-2">
                  <span>{marksCloudFailure}</span>
                  <button type="button" onClick={retryMarksCloudSync} className="self-start px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold">{RETRY_LABEL}</button>
                </div>
              )}

              {canEnterMarks && classStudents.length > 0 && (
                <div className="sticky bottom-[84px] z-30 pt-1">
                  <button
                    onClick={handleSaveMarks}
                    className="w-full py-3.5 px-4 rounded-[20px] brand-grad text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-violet-500/30 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Save size={17} />
                    <span>নম্বর সংরক্ষণ করুন</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============ TEACHER: MONTHLY ATTENDANCE REPORT ============ */}
          {activeSubModule === 'teacher_report_attendance' && (
            <div className="space-y-4">
              <div className={`${cardCls} p-5 space-y-3`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                    <BarChart3 size={18} />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold">{isEn ? 'Attendance Report — This Month' : 'হাজিরা রিপোর্ট — এই মাস'}</h2>
                    <p className="text-[11px] text-[#8a93a8]">{selectedClass}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={`${softBg} p-3 rounded-2xl`}>
                    <span className="text-[11px] font-semibold text-[#5b6478] dark:text-slate-400 block">{isEn ? 'School days' : 'কর্মদিবস'}</span>
                    <span className="text-lg font-black">{toBn(monthlyAttendance.schoolDays)}</span>
                  </div>
                  <div className="bg-[#d1fae5] dark:bg-emerald-500/10 p-3 rounded-2xl">
                    <span className="text-[11px] font-semibold text-[#059669] block">{isEn ? 'Avg. attendance' : 'গড় উপস্থিতি'}</span>
                    <span className="text-lg font-black text-[#059669] dark:text-emerald-300">{toBn(monthlyAttendance.rate)}%</span>
                  </div>
                  <div className={`${softBg} p-3 rounded-2xl`}>
                    <span className="text-[11px] font-semibold text-[#5b6478] dark:text-slate-400 block">{isEn ? 'Records' : 'মোট রেকর্ড'}</span>
                    <span className="text-lg font-black">{toBn(monthlyAttendance.totalRecords)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {classStudents.map(st => {
                  const rec = monthlyAttendance.perStudent.get(st.id);
                  const pct = rec && rec.total > 0 ? Math.round(((rec.present + rec.late) / rec.total) * 100) : null;
                  return (
                    <div key={st.id} className={`${cardCls} p-4 flex items-center justify-between gap-3`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-11 h-11 rounded-full brand-grad text-white font-bold flex items-center justify-center text-[15px] shadow-md shrink-0">
                          {(st.nameBn || st.name || 'শ').charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-[13px] font-bold truncate">{st.nameBn || st.name}</h3>
                          <p className="text-[11px] text-[#8a93a8]">
                            {rec
                              ? `${isEn ? 'Present' : 'উপস্থিত'} ${toBn(rec.present + rec.late)} • ${isEn ? 'Absent' : 'অনুপস্থিত'} ${toBn(rec.absent)} • ${isEn ? 'Leave' : 'ছুটি'} ${toBn(rec.leave)}`
                              : (isEn ? 'No record this month' : 'এই মাসে রেকর্ড নেই')}
                          </p>
                        </div>
                      </div>
                      {pct !== null && (
                        <span className={`text-xs font-black px-2.5 py-1.5 rounded-xl shrink-0 ${pct >= 85 ? 'bg-[#d1fae5] text-[#065f46] dark:bg-emerald-500/15 dark:text-emerald-300' : pct >= 60 ? 'bg-[#fef3c7] text-[#92400e] dark:bg-amber-500/15 dark:text-amber-300' : 'bg-[#fee2e2] text-[#991b1b] dark:bg-rose-500/15 dark:text-rose-300'}`}>
                          {toBn(pct)}%
                        </span>
                      )}
                    </div>
                  );
                })}
                {classStudents.length === 0 && (
                  <div className={`${cardCls} p-8 text-center`}>
                    <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">{selectedClass}-এ কোনো শিক্ষার্থী পাওয়া যায়নি।</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ TEACHER: CLASS RESULT REPORT ============ */}
          {activeSubModule === 'teacher_report_result' && (
            <div className="space-y-4">
              {classResultReport ? (
                <>
                  <div className={`${cardCls} p-5 space-y-3`}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 h-10 rounded-2xl brand-soft flex items-center justify-center">
                        <Award size={18} />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold">{classResultReport.exam.name}</h2>
                        <p className="text-[11px] text-[#8a93a8]">{selectedClass}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className={`${softBg} p-2.5 rounded-2xl`}>
                        <span className="text-[10px] font-semibold text-[#5b6478] dark:text-slate-400 block">{isEn ? 'Appeared' : 'অংশগ্রহণ'}</span>
                        <span className="text-base font-black">{toBn(classResultReport.appeared)}</span>
                      </div>
                      <div className="bg-[#d1fae5] dark:bg-emerald-500/10 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-semibold text-[#059669] block">{isEn ? 'Passed' : 'পাস'}</span>
                        <span className="text-base font-black text-[#059669] dark:text-emerald-300">{toBn(classResultReport.passed)}</span>
                      </div>
                      <div className="bg-[#fee2e2] dark:bg-rose-500/10 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-semibold text-[#dc2626] block">{isEn ? 'Failed' : 'ফেল'}</span>
                        <span className="text-base font-black text-[#dc2626] dark:text-rose-300">{toBn(classResultReport.failed)}</span>
                      </div>
                      <div className="bg-[#fef3c7] dark:bg-amber-500/10 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-semibold text-[#d97706] block">{isEn ? 'Avg GPA' : 'গড় GPA'}</span>
                        <span className="text-base font-black text-[#d97706] dark:text-amber-300">{toBn(classResultReport.avgGpa.toFixed(2))}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
                        <span className="text-[#5b6478] dark:text-slate-400">{isEn ? 'Pass rate' : 'পাসের হার'}</span>
                        <span>{toBn(classResultReport.passRate)}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: `${classResultReport.passRate}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {classResultReport.rows.map((r, idx) => (
                      <div key={r.student.id} className={`${cardCls} p-4 flex items-center justify-between gap-3`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 text-center text-sm font-black text-[#8a93a8] shrink-0">{toBn(idx + 1)}</span>
                          <span className="w-11 h-11 rounded-full brand-grad text-white font-bold flex items-center justify-center text-[15px] shadow-md shrink-0">
                            {(r.student.nameBn || r.student.name || 'শ').charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-[13px] font-bold truncate">{r.student.nameBn || r.student.name}</h3>
                            <p className="text-[11px] text-[#8a93a8]">
                              {r.has ? `${isEn ? 'Total' : 'মোট নম্বর'}: ${toBn(r.totalMarks)}` : (isEn ? 'Did not appear' : 'অংশ নেয়নি')}
                            </p>
                          </div>
                        </div>
                        {r.has && (
                          <div className="text-right shrink-0">
                            <span className={`text-xs font-black px-2.5 py-1.5 rounded-xl ${r.isFail ? 'bg-[#fee2e2] text-[#991b1b] dark:bg-rose-500/15 dark:text-rose-300' : 'bg-[#d1fae5] text-[#065f46] dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                              GPA {toBn(r.gpa.toFixed(2))}
                            </span>
                            <p className="text-[10px] text-[#8a93a8] mt-1 font-semibold">{isEn ? 'Grade' : 'গ্রেড'}: {r.grade}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={`${cardCls} p-8 text-center space-y-2`}>
                  <Award size={32} className="mx-auto text-[#c3c9d9]" />
                  <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">{isEn ? 'No exam found yet.' : 'এখনো কোনো পরীক্ষা তৈরি হয়নি।'}</p>
                </div>
              )}
            </div>
          )}

          {/* ============ NOTICES ============ */}
          {activeSubModule === 'teacher_notices' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Bell size={17} className="brand-text" />
                <h2 className="text-sm font-bold">মাদরাসা নোটিশ ও সার্কুলার</h2>
              </div>
              {notices.length === 0 ? (
                <div className={`${cardCls} p-8 text-center space-y-2`}>
                  <Bell size={32} className="mx-auto text-[#c3c9d9]" />
                  <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">কোনো সক্রিয় নোটিশ নেই।</p>
                </div>
              ) : (
                notices.map(notice => (
                  <div key={notice.id} className={`${cardCls} p-4 space-y-2`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-1 rounded-full bg-[#fef3c7] dark:bg-amber-500/15 text-[#92400e] dark:text-amber-300 font-bold">
                        {notice.category || 'সাধারণ নোটিশ'}
                      </span>
                      <span className="text-[11px] text-[#8a93a8]">{toBn(notice.publishDate || (notice as any).date || '')}</span>
                    </div>
                    <h3 className="text-[13px] font-bold">{notice.title}</h3>
                    <p className="text-xs text-[#5b6478] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{notice.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ============ TEACHER: MY CLASS ROUTINE ============ */}
          {activeSubModule === 'teacher_routine' && (
            <div className="space-y-4">
              <div className={`${cardCls} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-2xl bg-[#dbeafe] dark:bg-blue-500/15 text-[#2563eb] dark:text-blue-300 flex items-center justify-center">
                      <CalendarDays size={17} />
                    </span>
                    <h2 className="text-sm font-bold">{isEn ? 'My Routine' : 'আমার রুটিন'}</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full brand-soft font-bold">
                    {isEn ? 'Weekly' : 'সাপ্তাহিক'}
                  </span>
                </div>
                {routineIsClassFallback && (
                  <p className="text-[11px] text-[#5b6478] dark:text-slate-400 leading-relaxed">
                    {isEn
                      ? 'No period is assigned to you by name yet — showing the routine of your class(es).'
                      : 'আপনার নামে এখনো সরাসরি কোনো ঘণ্টা বরাদ্দ নেই — আপনার ক্লাসের রুটিন দেখানো হচ্ছে।'}
                  </p>
                )}

                {/* Weekday selector — today highlighted */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {DAYS_OF_WEEK.map(d => {
                    const isToday = d.en === todayDayEn;
                    const isSelected = d.en === routineDay;
                    return (
                      <button
                        key={d.en}
                        onClick={() => setRoutineDay(d.en)}
                        className={`px-3 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'brand-grad text-white shadow-md shadow-violet-500/25'
                            : 'bg-[#f4f6fb] dark:bg-white/5 text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10'
                        }`}
                      >
                        {isEn ? d.en.slice(0, 3) : d.shortBn}
                        {isToday && <span className={`ml-1 ${isSelected ? 'text-white' : 'brand-text'}`}>• {isEn ? 'Today' : 'আজ'}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#5b6478] dark:text-slate-400">
                    {(() => { const d = DAYS_OF_WEEK.find(x => x.en === routineDay); return isEn ? routineDay : (d ? d.bn : routineDay); })()}
                    {routineDay === todayDayEn && <span className="brand-text"> • {isEn ? 'Today' : 'আজ'}</span>}
                  </span>
                  <span className="text-[11px] text-[#8a93a8]">{toBn(routineDayItems.length)} {isEn ? 'periods' : 'টি ঘণ্টা'}</span>
                </div>

                {routineItems.length === 0 ? (
                  <div className={`${cardCls} p-8 text-center space-y-2`}>
                    <CalendarDays size={32} className="mx-auto text-[#c3c9d9]" />
                    <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">
                      {isEn ? 'No class routine has been created yet. Ask the office to publish the routine.' : 'এখনো কোনো ক্লাস রুটিন তৈরি হয়নি। রুটিন প্রকাশ করতে অফিসে জানান।'}
                    </p>
                  </div>
                ) : routineDayItems.length === 0 ? (
                  <div className={`${cardCls} p-8 text-center space-y-2`}>
                    <CalendarDays size={32} className="mx-auto text-[#c3c9d9]" />
                    <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">
                      {isEn ? 'No class for you on this day.' : 'এই দিনে আপনার কোনো ক্লাস নেই।'}
                    </p>
                  </div>
                ) : (
                  routineDayItems.map(item => (
                    <div key={item.id} className={`${cardCls} p-4 flex gap-3.5`}>
                      <div className="flex flex-col items-center shrink-0 w-[74px]">
                        <span className="text-[11px] font-black brand-soft px-2 py-1 rounded-lg text-center leading-tight">
                          {item.periodName || `${toBn(item.periodNumber)}`}
                        </span>
                        <span className="text-[10px] font-semibold text-[#8a93a8] mt-1.5 text-center leading-tight flex items-center gap-0.5">
                          <Clock size={10} className="shrink-0" />
                          {toBn(item.startTime)}
                        </span>
                        <span className="text-[10px] text-[#8a93a8] text-center leading-tight">{toBn(item.endTime)}</span>
                      </div>
                      <div className="w-px bg-[#e8ecf4] dark:bg-white/5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13px] font-bold leading-snug">{routineSubjectName(item)}</h3>
                        <p className="text-[11px] text-[#5b6478] dark:text-slate-400 mt-0.5">
                          {item.classLevel}{item.sectionName ? ` • ${isEn ? 'Section' : 'শাখা'}: ${item.sectionName}` : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {item.roomNumber && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 text-[#5b6478] dark:text-slate-300 flex items-center gap-1">
                              <MapPin size={9} /> {isEn ? 'Room' : 'কক্ষ'} {toBn(item.roomNumber)}
                            </span>
                          )}
                          {routineIsClassFallback && item.teacherName && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 text-[#5b6478] dark:text-slate-300">
                              {item.teacherName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ============ CASHIER: NATIVE FEE COLLECTION ============ */}
          {activeSubModule === 'cashier_collect' && (
            <div className="space-y-4">
              {!canCollectFees && (
                <div className="p-4 rounded-[24px] bg-[#fef3c7] dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex items-start gap-3">
                  <span className="w-9 h-9 rounded-2xl bg-[#f59e0b] text-white flex items-center justify-center shrink-0">
                    <Lock size={16} />
                  </span>
                  <div>
                    <h3 className="text-[13px] font-bold text-[#92400e] dark:text-amber-200">{isEn ? 'Fee collection is not enabled for your role' : 'আপনার রোলের জন্য ফি আদায় চালু নেই'}</h3>
                    <p className="text-[11px] text-[#92400e]/80 dark:text-amber-200/70 mt-0.5 leading-relaxed">
                      {isEn
                        ? 'You can view dues below, but collecting fees needs the fees/finance create permission. Contact the principal/admin.'
                        : 'নিচে বকেয়া তালিকা দেখতে পারবেন, তবে ফি আদায়ের জন্য ফি/ফাইন্যান্স তৈরির অনুমতি লাগবে। প্রিন্সিপাল/এডমিনের সাথে যোগাযোগ করুন।'}
                    </p>
                  </div>
                </div>
              )}

              {lastReceipt ? (
                /* ---- Receipt summary (in-app) ---- */
                <div className="space-y-4">
                  <div className={`${cardCls} p-5 space-y-3`}>
                    <div className="flex flex-col items-center text-center space-y-2 pb-1">
                      <span className="w-14 h-14 rounded-full bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                        <CheckCircle2 size={28} />
                      </span>
                      <h2 className="text-base font-black">{isEn ? 'Fee received!' : 'ফি গৃহীত হয়েছে!'}</h2>
                      <p className="text-[11px] text-[#8a93a8]">{schoolProfile.nameBn || schoolProfile.name}</p>
                    </div>
                    {/* Truthful receipt (25 Oct 2026): when the cloud
                        confirmation failed, the receipt is paper-valid but
                        NOT yet in the principal's ledger — say so plainly
                        with a retry action. */}
                    {!lastReceipt.cloudConfirmed && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold space-y-2">
                        <p>{isEn ? 'This receipt is only on this device for now — not yet in the cloud.' : RECEIPT_LOCAL_ONLY_NOTE}</p>
                        {feeCloudFailure && <p>{feeCloudFailure}</p>}
                        <button type="button" onClick={retryFeeCloudSync} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold">{isEn ? 'Retry' : RETRY_LABEL}</button>
                      </div>
                    )}
                    <div className="h-px bg-[#e8ecf4] dark:bg-white/5" />
                    {([
                      [isEn ? 'Receipt No' : 'রসিদ নং', lastReceipt.tx.voucherNo],
                      [isEn ? 'Student' : 'শিক্ষার্থী', lastReceipt.tx.studentNameBn || lastReceipt.tx.studentName || ''],
                      [isEn ? 'Class' : 'শ্রেণি', lastReceipt.tx.classLevel || ''],
                      [isEn ? 'Amount' : 'পরিমাণ', `৳${toBn(lastReceipt.tx.amount.toLocaleString())}`],
                      [isEn ? 'Method' : 'মাধ্যম', (FEE_METHODS.find(m => m.id === lastReceipt.tx.paymentMethod) || FEE_METHODS[0])[isEn ? 'en' : 'bn']],
                      [isEn ? 'Date' : 'তারিখ', toBn(lastReceipt.tx.date)],
                      [isEn ? 'Remaining due (this month)' : 'অবশিষ্ট বকেয়া (এই মাস)', `৳${toBn(lastReceipt.remainingDue.toLocaleString())}`]
                    ] as [string, string][]).map(([label, value], i) => (
                      <div key={i} className="flex items-center justify-between text-xs gap-3">
                        <span className="text-[#8a93a8] font-semibold shrink-0">{label}</span>
                        <span className="font-bold text-right">{value}</span>
                      </div>
                    ))}
                    {lastReceipt.tx.referenceNo && (
                      <div className="flex items-center justify-between text-xs gap-3">
                        <span className="text-[#8a93a8] font-semibold shrink-0">{isEn ? 'Reference' : 'রেফারেন্স'}</span>
                        <span className="font-bold text-right">{lastReceipt.tx.referenceNo}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setLastReceipt(null); setFeeStudentId(null); setFeeAmount(''); setFeeSearchQuery(''); }}
                    className="w-full py-3.5 px-4 rounded-[20px] brand-grad text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-violet-500/30 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Wallet size={17} />
                    <span>{isEn ? 'Collect another fee' : 'আরেকটি ফি আদায় করুন'}</span>
                  </button>
                </div>
              ) : selectedFeeProfile ? (
                /* ---- Fee entry form for the selected student ---- */
                <div className="space-y-4">
                  <div className={`${cardCls} p-4 space-y-3`}>
                    <button
                      onClick={() => setFeeStudentId(null)}
                      className="flex items-center gap-1.5 text-xs font-bold brand-text cursor-pointer"
                    >
                      <ArrowLeft size={14} /> {isEn ? 'Back to student list' : 'তালিকায় ফিরুন'}
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-full brand-grad text-white font-bold flex items-center justify-center text-base shadow-md shadow-violet-500/20 shrink-0">
                        {(selectedFeeProfile.student.nameBn || selectedFeeProfile.student.name || 'শ').charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-sm font-black leading-tight truncate">{selectedFeeProfile.student.nameBn || selectedFeeProfile.student.name}</h2>
                        <p className="text-[11px] text-[#8a93a8]">
                          {selectedFeeProfile.student.classLevel} • {isEn ? 'Roll' : 'রোল'}: {toBn(selectedFeeProfile.student.roll || selectedFeeProfile.student.rollNumber || '—')}
                          {selectedFeeProfile.student.guardianPhone ? ` • ${toBn(selectedFeeProfile.student.guardianPhone)}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className={`${softBg} p-2.5 rounded-2xl`}>
                        <span className="text-[10px] font-semibold text-[#5b6478] dark:text-slate-400 block">{isEn ? 'Monthly fee' : 'মাসিক ধার্য'}</span>
                        <span className="text-[13px] font-black">৳{toBn(selectedFeeProfile.monthlyExpected.toLocaleString())}</span>
                      </div>
                      <div className="bg-[#d1fae5] dark:bg-emerald-500/10 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-semibold text-[#059669] block">{isEn ? 'Paid' : 'পরিশোধিত'}</span>
                        <span className="text-[13px] font-black text-[#059669] dark:text-emerald-300">৳{toBn(selectedFeeProfile.paidThisMonth.toLocaleString())}</span>
                      </div>
                      <div className="bg-[#fee2e2] dark:bg-rose-500/10 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-semibold text-[#dc2626] block">{isEn ? 'Due' : 'বকেয়া'}</span>
                        <span className="text-[13px] font-black text-[#dc2626] dark:text-rose-300">৳{toBn(selectedFeeProfile.dueThisMonth.toLocaleString())}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`${cardCls} p-4 space-y-3.5`}>
                    <div>
                      <label className="text-[11px] text-[#8a93a8] font-semibold block mb-1.5">{isEn ? 'Amount (৳)' : 'টাকার পরিমাণ (৳)'}</label>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={feeAmount}
                        onChange={e => setFeeAmount(e.target.value)}
                        placeholder="০"
                        className="w-full py-3 px-3.5 bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-base font-black focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      {selectedFeeProfile.dueThisMonth > 0 && (
                        <button
                          type="button"
                          onClick={() => setFeeAmount(String(selectedFeeProfile.dueThisMonth))}
                          className="mt-1.5 text-[11px] font-bold brand-text cursor-pointer"
                        >
                          {isEn ? `Full due: ৳${toBn(selectedFeeProfile.dueThisMonth.toLocaleString())}` : `পুরো বকেয়া নিন: ৳${toBn(selectedFeeProfile.dueThisMonth.toLocaleString())}`}
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="text-[11px] text-[#8a93a8] font-semibold block mb-1.5">{isEn ? 'Payment method' : 'পরিশোধের মাধ্যম'}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {FEE_METHODS.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setFeeMethod(m.id)}
                            className={`px-3.5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                              feeMethod === m.id
                                ? 'brand-grad text-white shadow-md shadow-violet-500/25'
                                : 'bg-[#f4f6fb] dark:bg-white/5 text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10'
                            }`}
                          >
                            {isEn ? m.en : m.bn}
                          </button>
                        ))}
                      </div>
                    </div>

                    {feeMethod !== 'CASH' && (
                      <div>
                        <label className="text-[11px] text-[#8a93a8] font-semibold block mb-1.5">{isEn ? 'Transaction / reference no (optional)' : 'ট্রানজেকশন / রেফারেন্স নং (ঐচ্ছিক)'}</label>
                        <input
                          type="text"
                          value={feeRefNo}
                          onChange={e => setFeeRefNo(e.target.value)}
                          placeholder={isEn ? 'e.g. TrxID' : 'যেমন: TrxID'}
                          className="w-full py-2.5 px-3.5 bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] text-[#8a93a8] font-semibold block mb-1.5">{isEn ? 'Note (optional)' : 'মন্তব্য (ঐচ্ছিক)'}</label>
                      <input
                        type="text"
                        value={feeNote}
                        onChange={e => setFeeNote(e.target.value)}
                        className="w-full py-2.5 px-3.5 bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                    </div>
                  </div>

                  {canCollectFees && (
                    <div className="sticky bottom-[84px] z-30 pt-1">
                      <button
                        onClick={handleCollectFee}
                        disabled={!feeAmount || Number(feeAmount) <= 0}
                        className="w-full py-3.5 px-4 rounded-[20px] brand-grad text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-violet-500/30 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Receipt size={17} />
                        <span>{isEn ? 'Collect fee & save receipt' : 'ফি গ্রহণ করে রসিদ সংরক্ষণ করুন'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* ---- Student picker (search + dues list) ---- */
                <div className="space-y-4">
                  <div className={`${cardCls} p-4 space-y-1.5`}>
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                        <Wallet size={17} />
                      </span>
                      <h2 className="text-sm font-bold">{isEn ? 'Collect Fee' : 'ফি আদায়'}</h2>
                    </div>
                  </div>

                  <div className="p-4 space-y-1 rounded-[24px] bg-[#fee2e2] dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 shadow-[0_2px_12px_rgba(30,36,51,0.05)]">
                    <span className="text-[11px] font-bold text-[#dc2626] dark:text-rose-300 block">{isEn ? 'TOTAL DUE (all months)' : 'মোট বকেয়া (সব মাস মিলিয়ে)'}</span>
                    <span className="text-2xl font-black text-[#991b1b] dark:text-rose-200">৳{toBn((allDuesSummary.totalDue + cashierAging.totalAged).toLocaleString())}</span>
                    <p className="text-[11px] text-[#dc2626]/80 dark:text-rose-300/80 font-medium">
                      {isEn ? 'This month' : 'চলতি মাস'} ৳{toBn(allDuesSummary.totalDue.toLocaleString())} + {isEn ? 'old' : 'পুরনো'} ৳{toBn(cashierAging.totalAged.toLocaleString())}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#5b6478] dark:text-slate-400 shrink-0">{isEn ? 'Fee month:' : 'ফি মাস:'}</span>
                    <select
                      value={cashierViewMonth}
                      onChange={e => setCashierViewMonth(e.target.value)}
                      className="flex-1 py-3 px-3 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
                    >
                      {feeMonthOptions.map(m => (
                        <option key={m} value={m}>{bnMonthLabel(m)}{m === currentMonthStr ? (isEn ? ' (current)' : ' (চলতি)') : ''}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleCopyAllNumbers(feeSearchProfiles)}
                      className="px-3.5 py-3 rounded-2xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 text-xs font-bold cursor-pointer active:scale-95 shrink-0"
                    >
                      {copiedAllNumbers ? (isEn ? 'Copied ✓' : 'কপি হয়েছে ✓') : (isEn ? 'Copy All Numbers' : 'সব নম্বর কপি')}
                    </button>
                  </div>

                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a93a8]" />
                    <input
                      type="text"
                      value={feeSearchQuery}
                      onChange={e => setFeeSearchQuery(e.target.value)}
                      placeholder={isEn ? 'Search by name, roll, class or phone…' : 'নাম, রোল, শ্রেণি বা মোবাইল দিয়ে খুঁজুন...'}
                      className="w-full pl-10 pr-3 py-3 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-xs font-medium placeholder:text-[#8a93a8] focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>

                  <div className="space-y-2.5">
                    {feeSearchProfiles.length === 0 ? (
                      <div className={`${cardCls} p-8 text-center space-y-2`}>
                        <Users size={32} className="mx-auto text-[#c3c9d9]" />
                        <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">{isEn ? 'No student found.' : 'কোনো শিক্ষার্থী পাওয়া যায়নি।'}</p>
                      </div>
                    ) : (
                      feeSearchProfiles.slice(0, 60).map(p => {
                        const st = p.student;
                        const hasDue = p.dueThisMonth > 0;
                        const agedTotal = agingByStudent.get(st.id)?.totalAged || 0;
                        return (
                          <button
                            key={st.id}
                            onClick={() => handleSelectFeeStudent(p)}
                            className={`w-full text-left ${cardCls} p-4 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-all`}
                          >
                            <span className="w-10 h-10 rounded-full brand-grad text-white font-bold flex items-center justify-center text-sm shadow-md shadow-violet-500/20 shrink-0">
                              {(st.nameBn || st.name || 'শ').charAt(0)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-[13px] font-bold leading-tight truncate">{st.nameBn || st.name}</h3>
                              <p className="text-[11px] text-[#8a93a8] truncate">
                                {st.classLevel} • {isEn ? 'Roll' : 'রোল'}: {toBn(st.roll || st.rollNumber || '—')}
                              </p>
                              {agedTotal > 0 && (
                                <p className="text-[11px] font-semibold text-[#d97706] dark:text-amber-300 truncate">
                                  {isEn ? 'Old due: ' : 'পুরনো বকেয়া: '}৳{toBn(agedTotal.toLocaleString())}
                                </p>
                              )}
                            </div>
                            <span className={`text-[11px] font-black px-2.5 py-1.5 rounded-xl shrink-0 ${
                              hasDue ? 'bg-[#fee2e2] text-[#991b1b] dark:bg-rose-500/15 dark:text-rose-300' : 'bg-[#d1fae5] text-[#065f46] dark:bg-emerald-500/15 dark:text-emerald-300'
                            }`}>
                              {hasDue ? `${isEn ? 'Due' : 'বকেয়া'} ৳${toBn(p.dueThisMonth.toLocaleString())}` : (isEn ? 'Paid ✓' : 'পরিশোধিত ✓')}
                            </span>
                            <ChevronRight size={15} className="text-[#c3c9d9] shrink-0" />
                          </button>
                        );
                      })
                    )}
                    {feeSearchProfiles.length > 60 && (
                      <p className="text-center text-[11px] text-[#8a93a8] font-medium pt-1">
                        {isEn ? 'Showing first 60 — search to narrow down.' : 'প্রথম ৬০ জন দেখানো হচ্ছে — খুঁজে তালিকা ছোট করুন।'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ MOBILE: STUDENTS (Tutor pattern, native) ============ */}
          {activeSubModule === 'mobile_students' && (
            <div className="space-y-4">
              {/* Truthful-save Step 2-বাকি: toggle/delete cloud-failure banner */}
              {studentCloudFailure && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold flex flex-col gap-2">
                  <span>{studentCloudFailure}</span>
                  <button type="button" onClick={handleRetryStudentCloudSync} className="self-start px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold">{RETRY_LABEL}</button>
                </div>
              )}
              <div className={`${cardCls} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-2xl bg-[#dbeafe] dark:bg-blue-500/15 text-[#2563eb] dark:text-blue-300 flex items-center justify-center">
                      <Users size={17} />
                    </span>
                    <h2 className="text-sm font-bold">{isEn ? 'Students' : 'শিক্ষার্থী'}</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full brand-soft font-bold">
                    {toBn(filteredMobileStudents.length)} {isEn ? 'students' : 'জন'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {canManageStudents && (
                    <button
                      type="button"
                      onClick={() => handleOpenModule('student_admission')}
                      className="flex-1 py-3 rounded-2xl brand-grad text-white text-xs font-bold shadow-md shadow-violet-500/25 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      + {isEn ? 'New student' : 'নতুন শিক্ষার্থী'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenModule('students')}
                    className={`${canManageStudents ? 'flex-1' : 'w-full'} py-3 rounded-2xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 text-xs font-bold cursor-pointer active:scale-[0.98] transition-all`}
                  >
                    {isEn ? 'Full management' : 'পূর্ণ ব্যবস্থাপনা'}
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a93a8]" />
                  <input
                    type="text"
                    value={studentsSearch}
                    onChange={e => setStudentsSearch(e.target.value)}
                    placeholder={isEn ? 'Search by name, roll, class or phone…' : 'নাম, রোল, শ্রেণি বা মোবাইল দিয়ে খুঁজুন...'}
                    className="w-full pl-10 pr-3 py-3 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-xs font-medium placeholder:text-[#8a93a8] focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setStudentsClass('all')}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${studentsClass === 'all' ? 'brand-grad text-white shadow-md shadow-violet-500/25' : 'bg-white dark:bg-[#161c2e] text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10'}`}
                  >
                    {isEn ? 'All classes' : 'সব শ্রেণি'}
                  </button>
                  {studentClassNames.map(cn => (
                    <button
                      key={cn}
                      type="button"
                      onClick={() => setStudentsClass(cn)}
                      className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${studentsClass === cn ? 'brand-grad text-white shadow-md shadow-violet-500/25' : 'bg-white dark:bg-[#161c2e] text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10'}`}
                    >
                      {cn}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {([
                    ['all', isEn ? 'All' : 'সবাই'],
                    ['active', isEn ? 'Active' : 'সক্রিয়'],
                    ['inactive', isEn ? 'Inactive' : 'নিষ্ক্রিয়']
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setStudentsStatus(mode)}
                      className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${studentsStatus === mode ? 'brand-grad text-white shadow-md shadow-violet-500/25' : 'bg-white dark:bg-[#161c2e] text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredMobileStudents.length === 0 ? (
                  <div className={`${cardCls} p-8 text-center space-y-2`}>
                    <Users size={32} className="mx-auto text-[#c3c9d9]" />
                    <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">{isEn ? 'No student found.' : 'কোনো শিক্ষার্থী পাওয়া যায়নি।'}</p>
                  </div>
                ) : (
                  filteredMobileStudents.slice(0, 100).map(st => {
                    const active = isStudentActive(st);
                    const fee = calculateSingleStudentDue(st, feeStructures, transactions).monthlyExpected;
                    const phone = st.guardianPhone;
                    return (
                      <div key={st.id} className={`${cardCls} p-4 flex flex-col gap-3`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-10 h-10 rounded-full brand-grad text-white font-bold flex items-center justify-center text-sm shadow-md shadow-violet-500/20 shrink-0">
                              {(st.nameBn || st.name || 'শ').charAt(0)}
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-[13px] font-bold leading-tight truncate">{st.nameBn || st.name}</h3>
                              <p className="text-[11px] text-[#8a93a8] truncate">
                                {st.classLevel} • {isEn ? 'Roll' : 'রোল'}: {toBn(st.roll || st.rollNumber || '—')}
                              </p>
                              <p className="text-[11px] text-[#8a93a8] truncate">
                                {phone ? `${isEn ? 'Phone' : 'ফোন'}: ${toBn(phone)}` : (isEn ? 'No phone' : 'ফোন নম্বর নেই')} • {isEn ? 'Fee/mo' : 'মাসিক ফি'}: ৳{toBn(fee.toLocaleString())}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                            active ? 'bg-[#d1fae5] text-[#065f46] dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-[#f4f6fb] dark:bg-white/5 text-[#8a93a8] dark:text-slate-400'
                          }`}>
                            {studentStatusLabel(st)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {phone && (
                            <a href={`tel:${phone}`} className="px-3 py-2 rounded-xl bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 text-[11px] font-bold flex items-center gap-1">
                              <Phone size={11} /> {isEn ? 'Call' : 'কল'}
                            </a>
                          )}
                          {canManageStudents && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenModule('students')}
                                className="px-3 py-2 rounded-xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 text-[11px] font-bold cursor-pointer"
                              >
                                {isEn ? 'Edit' : 'এডিট'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStudentStatus(st, active)}
                                className="px-3 py-2 rounded-xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 text-[11px] font-bold cursor-pointer"
                              >
                                {active ? (isEn ? 'Deactivate' : 'নিষ্ক্রিয় করুন') : (isEn ? 'Activate' : 'সক্রিয় করুন')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentToDelete(st)}
                                className="px-3 py-2 rounded-xl bg-[#fee2e2] dark:bg-rose-500/10 text-[#dc2626] dark:text-rose-300 text-[11px] font-bold cursor-pointer"
                              >
                                {isEn ? 'Delete' : 'ডিলিট'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {filteredMobileStudents.length > 100 && (
                  <p className="text-center text-[11px] text-[#8a93a8] font-medium pt-1">
                    {isEn ? 'Showing first 100 — search to narrow down.' : 'প্রথম ১০০ জন দেখানো হচ্ছে — খুঁজে তালিকা ছোট করুন।'}
                  </p>
                )}
              </div>

              <ConfirmDialog
                isOpen={!!studentToDelete}
                onClose={() => { setStudentToDelete(null); setPendingStudentDelete(null); }}
                onConfirm={handleConfirmStudentDelete}
                title={isEn ? 'Confirm student deletion' : 'শিক্ষার্থী ডিলিট নিশ্চিতকরণ'}
                message={pendingStudentDelete
                  ? (STUDENT_DELETE_CLOUD_FAILURE_MESSAGE)
                  : (isEn
                    ? 'Are you sure you want to delete this student record? (It will be moved to the Trash Bin)'
                    : 'আপনি কি নিশ্চিত যে এই শিক্ষার্থীর সকল তথ্য ও রেকর্ড ডিলিট করতে চান? (এটি ট্র্যাশ বিনে জমা হবে এবং পরে প্রয়োজনে রিস্টোর করা যাবে)')}
                highlightText={studentToDelete ? `${studentToDelete.nameBn || studentToDelete.name} • ${studentToDelete.classLevel}` : undefined}
                variant="danger"
                confirmLabel={pendingStudentDelete ? RETRY_LABEL : undefined}
              />
            </div>
          )}

          {/* ============ PASSTHROUGH (shared desktop modules) ============ */}
          {!NATIVE_MODULES.includes(activeSubModule) && (
            <div className="w-full max-w-full overflow-x-hidden space-y-3">
              {renderModuleContent ? renderModuleContent(activeSubModule) : null}
            </div>
          )}
          </ServerDataGate>
        </main>

        {BottomNav}
        {MoreSheet}
      </div>
    );
  }

  // -------------------------------------------------------------
  // PROFILE SCREEN
  // -------------------------------------------------------------
  if (showProfile) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] text-[#1e2433] dark:text-slate-100 flex flex-col pb-24">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#161c2e]/95 backdrop-blur-xl border-b border-[#e8ecf4] dark:border-white/5 px-4 py-3.5">
          <h1 className="text-base font-black">আমার প্রোফাইল</h1>
        </header>

        <main className="p-4 space-y-4">
          <ServerDataGate dataNameBn="প্রোফাইল তথ্য" dataNameEn="Profile data">
          <div className={`${cardCls} p-5 flex flex-col items-center text-center space-y-3`}>
            <div className="w-20 h-20 rounded-[26px] brand-grad text-white font-black flex items-center justify-center text-3xl shadow-xl shadow-violet-500/30">
              {initialLetter}
            </div>
            <div>
              <h2 className="text-lg font-black leading-tight">{displayName}</h2>
              <p className="text-xs text-[#8a93a8] mt-0.5">{authUser?.email || currentMember?.email || currentUser?.email || ''}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {roleBadges.map((badge, idx) => (
                <span key={idx} className="px-3 py-1 rounded-full brand-soft text-[11px] font-bold">
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8a93a8] font-semibold">প্রতিষ্ঠান</span>
              <span className="font-bold text-right">{schoolProfile.nameBn || schoolProfile.name}</span>
            </div>
            <div className="h-px bg-[#e8ecf4] dark:bg-white/5" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8a93a8] font-semibold">দায়িত্ব</span>
              <span className="font-bold">{roleTitleBengali[userRole]}</span>
            </div>
            {userRole === 'teacher' && (
              <>
                <div className="h-px bg-[#e8ecf4] dark:bg-white/5" />
                <div className="flex items-start justify-between text-xs gap-3">
                  <span className="text-[#8a93a8] font-semibold shrink-0">আমার ক্লাস</span>
                  <span className="font-bold text-right">{teacherClasses.join(', ')}</span>
                </div>
              </>
            )}
            <div className="h-px bg-[#e8ecf4] dark:bg-white/5" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8a93a8] font-semibold">শিক্ষাবর্ষ</span>
              <span className="font-bold">{toBn(schoolProfile.academicYear || String(new Date().getFullYear()))}</span>
            </div>
          </div>

          {/* Step 4: own profile edit — display fields only (name, Bangla
              name, employee code). Email, phone, password, designation and
              class assignments stay admin-only: they feed login identity,
              provisioning, role derivation and access scoping. */}
          <div className={`${cardCls} p-5 space-y-3`}>
            <p className="text-xs font-bold">{isEn ? 'Edit my information' : 'আমার তথ্য সম্পাদনা'}</p>
            {profileSuccess && (
              <div className="p-3 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[#065f46] dark:text-emerald-300 text-xs font-bold">
                {profileSuccess}
              </div>
            )}
            {profileFailure && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold flex flex-col gap-2">
                <span>{profileFailure}</span>
                <button type="button" onClick={retryProfileCloudSync} className="self-start px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold">{RETRY_LABEL}</button>
              </div>
            )}
            {!myTeacherRecord ? (
              <p className="text-xs font-semibold text-[#8a93a8]">
                {isEn ? 'No staff record is linked to this account — please contact the office to update your information.' : 'এই অ্যাকাউন্টের সাথে কোনো স্টাফ রেকর্ড যুক্ত নেই — তথ্য বদলাতে অফিসে যোগাযোগ করুন।'}
              </p>
            ) : !editingProfile ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8a93a8] font-semibold">{isEn ? 'Name' : 'নাম'}</span>
                  <span className="font-bold">{myTeacherRecord.name}</span>
                </div>
                <div className="h-px bg-[#e8ecf4] dark:bg-white/5" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8a93a8] font-semibold">{isEn ? 'Bangla name' : 'বাংলা নাম'}</span>
                  <span className="font-bold">{myTeacherRecord.nameBn || '—'}</span>
                </div>
                <div className="h-px bg-[#e8ecf4] dark:bg-white/5" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8a93a8] font-semibold">{isEn ? 'Employee code' : 'কর্মী কোড'}</span>
                  <span className="font-bold">{myTeacherRecord.employeeCode || '—'}</span>
                </div>
                <button
                  type="button"
                  onClick={startProfileEdit}
                  className="w-full py-3 rounded-2xl text-xs font-bold brand-grad text-white active:scale-[0.98] transition-all cursor-pointer"
                >
                  {isEn ? 'Edit' : 'সম্পাদনা করুন'}
                </button>
                <p className="text-[11px] font-semibold text-[#8a93a8]">
                  {isEn ? 'Email, phone, password, designation and class assignments can only be changed by the office.' : 'ইমেইল, ফোন নম্বর, পাসওয়ার্ড, পদবি ও ক্লাস বণ্টন বদলাতে অফিসে যোগাযোগ করুন।'}
                </p>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold block mb-1.5">{isEn ? 'Name' : 'নাম'}</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full py-3 px-3 rounded-2xl text-sm font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1.5">{isEn ? 'Bangla name' : 'বাংলা নাম'}</label>
                  <input
                    value={editNameBn}
                    onChange={(e) => setEditNameBn(e.target.value)}
                    className="w-full py-3 px-3 rounded-2xl text-sm font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1.5">{isEn ? 'Employee code' : 'কর্মী কোড'}</label>
                  <input
                    value={editEmployeeCode}
                    onChange={(e) => setEditEmployeeCode(e.target.value)}
                    className="w-full py-3 px-3 rounded-2xl text-sm font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSaveProfileEdit}
                    className="py-3 rounded-2xl text-xs font-bold brand-grad text-white active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isEn ? 'Save' : 'সংরক্ষণ করুন'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="py-3 rounded-2xl text-xs font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 text-[#5b6478] dark:text-slate-300 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isEn ? 'Cancel' : 'বাতিল'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Appearance: display mode, accent colour, language */}
          <div className={`${cardCls} p-5 space-y-5`}>
            <div>
              <p className="text-xs font-bold mb-2.5 flex items-center gap-1.5">
                {darkMode ? <Moon size={13} /> : <Sun size={13} />}
                {isEn ? 'Display Mode' : 'ডিসপ্লে মোড'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDarkMode(false)}
                  className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${!darkMode ? 'brand-grad text-white shadow-lg' : `${softBg} text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10`}`}
                >
                  <Sun size={15} /> {isEn ? 'Light' : 'লাইট'}
                </button>
                <button
                  onClick={() => setDarkMode(true)}
                  className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${darkMode ? 'brand-grad text-white shadow-lg' : `${softBg} text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10`}`}
                >
                  <Moon size={15} /> {isEn ? 'Dark' : 'ডার্ক'}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold mb-2.5">{isEn ? 'Accent Colour' : 'অ্যাকসেন্ট রঙ'}</p>
              <div className="flex items-start gap-3">
                {ACCENT_THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAccentTheme(t.id)}
                    className="flex flex-col items-center gap-1.5 cursor-pointer"
                    aria-label={t.nameEn}
                  >
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all ${accentTheme === t.id ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-[#161c2e] scale-105' : ''}`}
                      style={{ backgroundColor: t.primary, ['--tw-ring-color' as any]: t.ring }}
                    >
                      {accentTheme === t.id && <Check size={16} />}
                    </span>
                    <span className={`text-[9px] font-semibold leading-tight text-center ${accentTheme === t.id ? '' : 'text-[#8a93a8]'}`}>{isEn ? t.nameEn : t.nameBn}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold mb-2.5 flex items-center gap-1.5">
                <Globe size={13} /> {isEn ? 'Language' : 'ভাষা / Language'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setLanguage('bn')}
                  className={`py-3 rounded-2xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98] ${!isEn ? 'brand-grad text-white shadow-lg' : `${softBg} text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10`}`}
                >
                  বাংলা
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`py-3 rounded-2xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98] ${isEn ? 'brand-grad text-white shadow-lg' : `${softBg} text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10`}`}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          <div className={`${cardCls} p-4 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl brand-soft flex items-center justify-center">
                <Sparkles size={18} />
              </span>
              <div>
                <p className="text-xs font-bold">{isEn ? 'Install App' : 'অ্যাপ ইনস্টল করুন'}</p>
              </div>
            </div>
            <PWAInstallButton />
          </div>

          <button
            onClick={() => (onLogout ? onLogout() : logoutAdmin())}
            className="w-full py-3.5 rounded-[20px] bg-[#fee2e2] dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-[#dc2626] dark:text-rose-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
          >
            <LogOut size={16} />
            <span>লগআউট / একাউন্ট পরিবর্তন</span>
          </button>
        </ServerDataGate>
        </main>

        {BottomNav}
        {MoreSheet}
        <OfflineIndicator />
      </div>
    );
  }

  // -------------------------------------------------------------
  // STAFF LEAVE REQUEST (Step 4) — staff-submitted requests are ALWAYS
  // PENDING here; approval happens on desktop. Staff self-attendance is
  // deliberately not offered (admin-only, user's decision).
  // -------------------------------------------------------------
  if (showLeave) {
    const leaveDaysPreview = computeLeaveDays(leaveStart, leaveEnd);
    return (
      <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] text-[#1e2433] dark:text-slate-100 flex flex-col pb-24">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#161c2e]/95 backdrop-blur-xl border-b border-[#e8ecf4] dark:border-white/5 px-4 py-3.5">
          <h1 className="text-base font-black">{isEn ? 'Leave Request' : 'ছুটির আবেদন'}</h1>
        </header>

        <main className="p-4 space-y-4">
          <ServerDataGate dataNameBn="ছুটির তথ্য" dataNameEn="Leave data">
          {leaveSuccess && (
            <div className="p-3 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[#065f46] dark:text-emerald-300 text-xs font-bold">
              {leaveSuccess}
            </div>
          )}
          {leaveFailure && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold flex flex-col gap-2">
              <span>{leaveFailure}</span>
              <button type="button" onClick={retryLeaveCloudSync} className="self-start px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold">{RETRY_LABEL}</button>
            </div>
          )}

          {!myLeaveIdentity ? (
            <div className={`${cardCls} p-5 text-xs font-bold text-[#5b6478] dark:text-slate-300`}>
              {isEn ? 'No staff record is linked to this account — please contact the office to file leave.' : 'এই অ্যাকাউন্টের সাথে কোনো স্টাফ রেকর্ড যুক্ত নেই — ছুটির আবেদন করতে অফিসে যোগাযোগ করুন।'}
            </div>
          ) : (
            <form onSubmit={handleSubmitLeave} className={`${cardCls} p-5 space-y-4`}>
              <div>
                <label className="text-xs font-bold block mb-1.5">{isEn ? 'Leave type' : 'ছুটির ধরন'}</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as StaffLeaveRecord['leaveType'])}
                  className="w-full py-3 px-3 rounded-2xl text-sm font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10"
                >
                  {STAFF_LEAVE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{isEn ? o.labelEn : o.labelBn}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1.5">{isEn ? 'From' : 'শুরু'}</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full py-3 px-3 rounded-2xl text-sm font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1.5">{isEn ? 'To' : 'শেষ'}</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full py-3 px-3 rounded-2xl text-sm font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10"
                  />
                </div>
              </div>
              {leaveDaysPreview > 0 && (
                <p className="text-xs font-bold text-[#5b6478] dark:text-slate-300">
                  {isEn ? `Total: ${leaveDaysPreview} day(s)` : `মোট: ${toBn(leaveDaysPreview)} দিন`}
                </p>
              )}
              <div>
                <label className="text-xs font-bold block mb-1.5">{isEn ? 'Reason' : 'কারণ'}</label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  rows={3}
                  className="w-full py-3 px-3 rounded-2xl text-sm font-bold bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10"
                />
              </div>
              <button
                type="submit"
                disabled={leaveSubmitting}
                className="w-full py-3.5 rounded-[20px] brand-grad text-white text-sm font-bold active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isEn ? 'Submit leave request' : 'ছুটির আবেদন জমা দিন'}
              </button>
              <p className="text-[11px] font-semibold text-[#8a93a8]">
                {isEn ? 'Your request goes to the principal/admin as pending — it counts only after approval.' : 'আবেদনটি অধ্যক্ষ/প্রশাসনের কাছে অপেক্ষমাণ হিসেবে যাবে — অনুমোদন হলেই শুধু গণনায় আসবে।'}
              </p>
            </form>
          )}

          <div className={`${cardCls} p-5 space-y-3`}>
            <p className="text-xs font-bold">{isEn ? 'My leave requests' : 'আমার ছুটির আবেদন'}</p>
            {myLeaves.length === 0 ? (
              <p className="text-xs font-semibold text-[#8a93a8]">{isEn ? 'No leave requests yet.' : 'এখনো কোনো ছুটির আবেদন নেই।'}</p>
            ) : (
              myLeaves.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 py-2 border-b border-[#e8ecf4] dark:border-white/5 last:border-0">
                  <div className="text-xs">
                    <p className="font-bold">{l.startDate}{l.startDate !== l.endDate ? ` → ${l.endDate}` : ''}</p>
                    <p className="text-[#8a93a8] font-semibold">{l.reason || (isEn ? 'No reason given' : 'কারণ দেওয়া হয়নি')}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${l.status === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300' : l.status === 'PENDING' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300' : 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'}`}>
                    {l.status === 'APPROVED' ? (isEn ? 'Approved' : 'অনুমোদিত') : l.status === 'PENDING' ? (isEn ? 'Pending' : 'অপেক্ষমাণ') : (isEn ? 'Rejected' : 'বাতিল')}
                  </span>
                </div>
              ))
            )}
          </div>
        </ServerDataGate>
        </main>

        {BottomNav}
        {MoreSheet}
        <OfflineIndicator />
      </div>
    );
  }

  // -------------------------------------------------------------
  // HOME DASHBOARD — Tutor App style
  // (gradient hero with quick-action tiles inside, airy stat cards,
  //  progress cards, soft nudges — logic unchanged, presentation new)
  // -------------------------------------------------------------
  const tileLabels: Record<string, string> = {
    attendance: 'হাজিরা',
    students_dues: 'বকেয়া',
    marks: 'নম্বর',
    routine: 'রুটিন',
    notices: 'নোটিশ',
    finance_collect: 'ফি আদায়',
    finance_expense: 'খরচ',
    students: 'ছাত্র',
    finance_reports: 'রিপোর্ট',
    results: 'ফলাফল',
    finance: 'ফি',
    id_cards: 'আইডি কার্ড'
  };

  // Principal uses the whole-madrasa cards above (roleStats cannot see
  // cashierAging — it is defined after roleStats in this file).
  const statsRow = userRole === 'principal' ? principalStatCards : [
    { value: roleStats.stat1Value, label: roleStats.stat1Label, Icon: roleStats.stat1Icon, cls: roleStats.stat1Cls },
    { value: roleStats.stat2Value, label: roleStats.stat2Label, Icon: roleStats.stat2Icon, cls: roleStats.stat2Cls },
    { value: roleStats.stat3Value, label: roleStats.stat3Label, Icon: roleStats.stat3Icon, cls: roleStats.stat3Cls }
  ];

  const attendanceTakenPct = attendanceStats.total > 0 ? Math.round((attendanceStats.takenCount / attendanceStats.total) * 100) : 0;
  const cashierNet = cashierFigures.todayIncome - todayExpense;
  const cashierBarMax = Math.max(cashierFigures.todayIncome, todayExpense, 1);

  return (
    <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] text-[#1e2433] dark:text-slate-100 flex flex-col pb-24">
      {/* Top bar — sticky with soft blur */}
      <header className="sticky top-0 z-40 bg-[#f4f6fb]/85 dark:bg-[#0e1220]/85 backdrop-blur-xl px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-[16px] brand-grad text-white font-black flex items-center justify-center text-lg shadow-lg shrink-0">
          {initialLetter}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#5b6478] dark:text-slate-400">{todayGreeting.greeting} 👋</p>
          <h1 className="text-lg font-black leading-tight truncate">{displayName}</h1>
        </div>
        <button
          onClick={toggleDarkMode}
          aria-label="Toggle light/dark mode"
          className="w-10 h-10 rounded-2xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 flex items-center justify-center text-[#5b6478] dark:text-amber-300 cursor-pointer active:scale-95 transition-all shrink-0"
        >
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        {/* Tutor-style accent + mode picker — one tap applies app-wide
            via ThemeContext (accent + dark mode persist to localStorage). */}
        <div className="relative shrink-0" ref={themePickerRef}>
          <button
            onClick={() => setShowThemePicker(o => !o)}
            aria-label={isEn ? 'Accent color and mode' : 'অ্যাকসেন্ট কালার ও মোড'}
            title={isEn ? 'Accent color and mode' : 'অ্যাকসেন্ট কালার ও মোড'}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 flex items-center justify-center text-[#5b6478] dark:text-slate-300 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Palette size={19} />
          </button>

          {showThemePicker && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl p-4 shadow-xl z-50 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10">
              <p className="text-[13px] font-semibold mb-2.5 text-[#1e2433] dark:text-slate-100">
                {isEn ? 'Accent color' : 'অ্যাকসেন্ট কালার'}
              </p>
              <div className="flex items-center gap-2.5 mb-4">
                {ACCENT_THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAccentTheme(t.id)}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shrink-0"
                    style={{
                      background: t.primary,
                      outline: accentTheme === t.id ? `2px solid ${t.primary}` : 'none',
                      outlineOffset: '3px',
                    }}
                    title={isEn ? t.nameEn : t.nameBn}
                    aria-label={isEn ? t.nameEn : t.nameBn}
                  >
                    {accentTheme === t.id && <Check size={16} className="text-white" />}
                  </button>
                ))}
              </div>

              <p className="text-[13px] font-semibold mb-2.5 text-[#1e2433] dark:text-slate-100">
                {isEn ? 'Mode' : 'মোড'}
              </p>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#f4f6fb] dark:bg-white/5">
                <button
                  onClick={() => setDarkMode(false)}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${!darkMode ? 'bg-white dark:bg-[#161c2e] text-[#1e2433] dark:text-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[#5b6478] dark:text-slate-400'}`}
                >
                  <Sun size={16} />
                  {isEn ? 'Light' : 'লাইট'}
                </button>
                <button
                  onClick={() => setDarkMode(true)}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${darkMode ? 'bg-white dark:bg-[#161c2e] text-[#1e2433] dark:text-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[#5b6478] dark:text-slate-400'}`}
                >
                  <Moon size={16} />
                  {isEn ? 'Dark' : 'ডার্ক'}
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          aria-label="Notifications"
          className="relative w-10 h-10 rounded-2xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 flex items-center justify-center text-[#5b6478] dark:text-slate-300 cursor-pointer active:scale-95 transition-all shrink-0"
        >
          <Bell size={17} />
          {notices.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold flex items-center justify-center">
              {toBn(Math.min(notices.length, 9))}
            </span>
          )}
        </button>

        {showNotifications && (
          <div className={`absolute right-4 top-[72px] w-[300px] max-w-[calc(100vw-2rem)] ${cardCls} p-3 z-50 space-y-1`}>
            <p className="text-xs font-black px-1 pb-1">{isEn ? 'Latest notices' : 'সর্বশেষ নোটিশ'}</p>
            {notices.length === 0 && (
              <p className="text-[11px] text-[#8a93a8] px-1 py-2">{isEn ? 'No notices yet.' : 'এখনো কোনো নোটিশ নেই।'}</p>
            )}
            {notices.slice(0, 5).map(n => (
              <button
                key={n.id}
                onClick={() => { setShowNotifications(false); handleOpenModule(userRole === 'teacher' ? 'teacher_notices' : 'notice_board'); }}
                className="w-full text-left px-2 py-2 rounded-xl hover:bg-[#f4f6fb] dark:hover:bg-white/5 cursor-pointer"
              >
                <p className="text-xs font-bold truncate">{n.title}</p>
                <p className="text-[10px] text-[#8a93a8]">{toBn(n.publishDate || (n as any).date || '')}</p>
              </button>
            ))}
          </div>
        )}
      </header>

      {successToast}
      {attendanceCloudFailureToast}

      <main className="flex-1 p-4 space-y-4 anim-stagger">
        <ServerDataGate dataNameBn="ড্যাশবোর্ড তথ্য" dataNameEn="Dashboard data">
        {/* HERO — gradient greeting + quick actions inside (Tutor App pattern:
            greeting, "Today at a glance", QUICK ACTIONS row) */}
        <section className="relative overflow-hidden rounded-3xl brand-grad text-white p-5 shadow-xl">
          <div className="absolute w-40 h-40 -top-10 -right-10 rounded-full bg-white/[0.14] pointer-events-none" />
          <div className="absolute w-24 h-24 bottom-2 right-32 rounded-full bg-white/[0.10] pointer-events-none" />
          <div className="relative">
            <p className="text-[13px] font-medium text-white/85">{todayGreeting.fullDateText}</p>
            <h2 className="text-[22px] font-black mt-0.5 leading-snug">{roleTitleBengali[userRole]}</h2>
            <p className="text-[13px] text-white/80 mt-0.5">{schoolProfile.nameBn || schoolProfile.name}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mt-3">
              {isEn ? 'Today at a glance' : 'আজকের সারসংক্ষেপ'}
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3">
              {roleBadges.map((b, i) => (
                <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.16]">
                  {b}
                </span>
              ))}
            </div>

            {/* Multi-role view switcher — only for people holding more
                than one role with a mobile home (e.g. accountant +
                teacher). Single-role users never see this. */}
            {availableHomes.length > 1 && (
              <div className="flex gap-1.5 mt-4 p-1 rounded-full bg-white/[0.16]">
                {availableHomes.map(h => {
                  const label =
                    h === 'teacher' ? (isEn ? 'Teacher' : 'শিক্ষক') :
                    h === 'cashier' ? (isEn ? 'Cashier' : 'হিসাবরক্ষক') :
                    h === 'parent' ? (isEn ? 'Guardian' : 'অভিভাবক') :
                    h === 'principal' ? (isEn ? 'Principal' : 'অধ্যক্ষ') :
                    (isEn ? 'Office' : 'অফিস');
                  const isActive = userRole === h;
                  return (
                    <button
                      key={h}
                      onClick={() => { setHomeOverride(h); goHome(); }}
                      className={`flex-1 px-3 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        isActive ? 'bg-white text-[#1e2433] shadow-md' : 'text-white/85 active:bg-white/[0.14]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mt-5 mb-2.5">
              {isEn ? 'Quick actions' : 'দ্রুত কাজ'}
            </p>
            <div className={`grid ${roleActions.filter(a => a.id !== 'notices').length === 3 ? 'grid-cols-3' : 'grid-cols-4'} gap-2`}>
              {roleActions.filter(a => a.id !== 'notices').map(a => {
                const TileIcon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      // Guardian tiles open the portal on their tab
                      // (action ids mirror the portal tabs; the fee
                      // tile's id is 'finance', the tab is 'fees').
                      if (a.moduleKey === 'guardian_portal') {
                        setPortalTabHint(a.id === 'attendance' ? 'attendance' : a.id === 'finance' ? 'fees' : 'results');
                      }
                      handleOpenModule(a.moduleKey);
                    }}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-[20px] py-3 px-1 min-h-[72px] bg-white/[0.16] active:bg-white/[0.28] active:scale-95 transition-all cursor-pointer"
                  >
                    <TileIcon size={22} className="text-white" />
                    <span className="text-[11px] font-semibold text-white leading-tight text-center">
                      {tileLabels[a.id] || a.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* STAT CARDS — icon chip on top, big value, soft label (Tutor App pattern) */}
        <section className="grid grid-cols-3 gap-3">
          {statsRow.map((s, i) => (
            <div key={i} className={`${cardCls} p-4`}>
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.cls}`}>
                <s.Icon size={19} />
              </span>
              <p className="text-[16px] font-black leading-tight mt-3 break-words">{s.value}</p>
              <p className="text-[11px] font-medium text-[#5b6478] dark:text-slate-400 mt-0.5 leading-snug">{s.label}</p>
            </div>
          ))}
        </section>

        {/* PARENT: my children — the guardian's OWN child(ren) only.
            An unlinked guardian gets the honest no-link state, never
            another student's card. */}
        {userRole === 'parent' && guardianChildren !== null && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <h3 className="text-sm font-black flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                <GraduationCap size={15} />
              </span>
              {isEn ? 'My children' : 'আমার সন্তান'}
            </h3>
            {guardianChildren.length === 0 ? (
              <p className="text-xs font-semibold text-[#5b6478] dark:text-slate-400 leading-relaxed">
                {isEn
                  ? 'No student linked yet — please contact the office'
                  : 'কোনো শিক্ষার্থী যুক্ত করা হয়নি — অফিসে যোগাযোগ করুন'}
              </p>
            ) : (
              <div className="space-y-2">
                {guardianChildren.map(child => {
                  const due = calculateSingleStudentDue(child, feeStructures, transactions);
                  return (
                    <button
                      key={child.id}
                      onClick={() => { setPortalTabHint('results'); handleOpenModule('guardian_portal'); }}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 text-left active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span className="w-10 h-10 rounded-xl brand-soft flex items-center justify-center font-black text-sm shrink-0">
                        {(child.nameBn || child.name || 'শ')[0]}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-black truncate">{child.nameBn || child.name}</span>
                        <span className="block text-[11px] font-medium text-[#5b6478] dark:text-slate-400">
                          {child.classLevel}{child.roll ? ` • ${isEn ? 'Roll' : 'রোল'} ${toBn(child.roll)}` : ''}
                        </span>
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                        due.dueThisMonth > 0
                          ? 'bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300'
                          : 'bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300'
                      }`}>
                        {due.dueThisMonth > 0 ? `${isEn ? 'Due' : 'বকেয়া'} ৳${toBn(due.dueThisMonth.toLocaleString())}` : (isEn ? 'Paid' : 'পরিশোধিত')}
                      </span>
                      <ChevronRight size={15} className="text-[#c3c9d9] shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TEACHER: today's attendance progress */}
        {userRole === 'teacher' && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                  <CheckSquare size={15} />
                </span>
                {isEn ? "Today's Attendance" : 'আজকের হাজিরা'}
              </h3>
              <span className="text-[11px] px-2.5 py-1 rounded-full brand-soft font-bold">{selectedClass}</span>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-[32px] leading-none font-black">
                {toBn(attendanceStats.rate)}<span className="text-lg text-[#8a93a8]">%</span>
              </p>
              <p className="text-[11px] font-semibold text-[#5b6478] dark:text-slate-400">
                {isEn ? 'Taken' : 'নেওয়া হয়েছে'} {toBn(attendanceStats.takenCount)}/{toBn(attendanceStats.total)} {isEn ? 'students' : 'জন'}
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#34d399] to-[#10b981] transition-all" style={{ width: `${attendanceTakenPct}%` }} />
            </div>
            <p className="text-[11px] text-[#5b6478] dark:text-slate-400 font-medium">
              {isEn ? 'Present' : 'উপস্থিত'} {toBn(attendanceStats.present)} • {isEn ? 'Absent' : 'অনুপস্থিত'} {toBn(attendanceStats.absent)} • {isEn ? 'Late' : 'দেরি'} {toBn(attendanceStats.late)} • {isEn ? 'Leave' : 'ছুটি'} {toBn(attendanceStats.leave)}
            </p>
            <button
              onClick={() => handleOpenModule('teacher_attendance')}
              className="w-full py-3.5 rounded-2xl brand-grad text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all cursor-pointer"
            >
              <CheckSquare size={16} />
              <span>{attendanceStats.takenCount >= attendanceStats.total && attendanceStats.total > 0 ? (isEn ? 'Attendance done — review' : 'হাজিরা সম্পন্ন ✓ — আবার দেখুন') : (isEn ? 'Take attendance' : 'হাজিরা নিতে যান')}</span>
            </button>
          </section>
        )}

        {/* TEACHER: today's routine strip */}
        {userRole === 'teacher' && routineItems.length > 0 && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#dbeafe] dark:bg-blue-500/15 text-[#2563eb] dark:text-blue-300 flex items-center justify-center">
                  <CalendarDays size={15} />
                </span>
                {isEn ? "Today's Routine" : 'আজকের রুটিন'}
              </h3>
              <button
                onClick={() => handleOpenModule('teacher_routine')}
                className="text-[11px] font-bold brand-text flex items-center gap-0.5 cursor-pointer"
              >
                {isEn ? 'Full week' : 'পুরো সপ্তাহ'} <ChevronRight size={12} />
              </button>
            </div>
            {routineIsClassFallback && (
              <p className="text-[11px] text-[#8a93a8] font-medium -mt-1">
                {isEn ? 'Showing your class routine (no period is assigned to you by name yet).' : 'আপনার ক্লাসের রুটিন দেখানো হচ্ছে (নামে ঘণ্টা বরাদ্দ হয়নি)।'}
              </p>
            )}
            {todaysRoutineItems.length === 0 ? (
              <p className="text-xs text-[#8a93a8] font-medium py-1">{isEn ? 'No class for you today.' : 'আজ আপনার কোনো ক্লাস নেই।'}</p>
            ) : (
              <div className="space-y-2">
                {todaysRoutineItems.slice(0, 4).map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleOpenModule('teacher_routine')}
                    className="w-full flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-all"
                  >
                    <span className="text-[11px] font-black brand-soft px-2 py-1.5 rounded-lg shrink-0 w-[86px] text-center leading-tight">
                      {toBn(item.startTime)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate">{routineSubjectName(item)}</p>
                      <p className="text-[11px] text-[#8a93a8] truncate">
                        {item.classLevel}{item.sectionName ? ` • ${isEn ? 'Section' : 'শাখা'}: ${item.sectionName}` : ''}{item.periodName ? ` • ${item.periodName}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-[#c3c9d9] shrink-0" />
                  </button>
                ))}
                {todaysRoutineItems.length > 4 && (
                  <p className="text-[11px] text-[#8a93a8] font-medium pl-1">
                    + {toBn(todaysRoutineItems.length - 4)} {isEn ? 'more periods today' : 'টি ঘণ্টা আরও আছে আজ'}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* TEACHER: class reports */}
        {userRole === 'teacher' && (
          <section className="space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2 px-0.5">
              <span className="w-1 h-4 rounded-full brand-bg" />
              {isEn ? 'My Class Reports' : 'আমার ক্লাসের রিপোর্ট'}
            </h3>
            <div className={`${cardCls} p-5 space-y-5`}>
              <button onClick={() => handleOpenModule('teacher_report_attendance')} className="w-full text-left cursor-pointer active:scale-[0.99] transition-all">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 text-[13px] font-bold">
                    <span className="w-8 h-8 rounded-xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                      <BarChart3 size={15} />
                    </span>
                    {isEn ? 'Attendance — this month' : 'হাজিরা রিপোর্ট — এই মাস'}
                  </span>
                  <span className="text-sm font-black text-[#059669] dark:text-emerald-300">{toBn(monthlyAttendance.rate)}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden ml-10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: `${monthlyAttendance.rate}%` }} />
                </div>
                <p className="text-[11px] text-[#8a93a8] ml-10 mt-1.5">
                  {isEn ? 'School days' : 'কর্মদিবস'} {toBn(monthlyAttendance.schoolDays)} {isEn ? 'days' : 'দিন'}
                </p>
              </button>

              <button onClick={() => handleOpenModule('teacher_report_result')} className="w-full text-left cursor-pointer active:scale-[0.99] transition-all">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 text-[13px] font-bold">
                    <span className="w-8 h-8 rounded-xl brand-soft flex items-center justify-center">
                      <Award size={15} />
                    </span>
                    {isEn ? 'Result — latest exam' : 'ফলাফল — সর্বশেষ পরীক্ষা'}
                  </span>
                  <span className="text-sm font-black brand-text">
                    {classResultReport ? `${isEn ? 'Pass' : 'পাস'} ${toBn(classResultReport.passRate)}%` : '—'}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden ml-10">
                  <div className="h-full rounded-full brand-grad" style={{ width: `${classResultReport ? classResultReport.passRate : 0}%` }} />
                </div>
                <p className="text-[11px] text-[#8a93a8] ml-10 mt-1.5">
                  {classResultReport
                    ? `${classResultReport.exam.name} • ${isEn ? 'Avg GPA' : 'গড় GPA'} ${toBn(classResultReport.avgGpa.toFixed(2))}`
                    : (isEn ? 'No exam yet' : 'এখনো পরীক্ষা হয়নি')}
                </p>
              </button>

              <button onClick={() => handleOpenModule('teacher_students_dues')} className="w-full text-left cursor-pointer active:scale-[0.99] transition-all">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 text-[13px] font-bold">
                    <span className="w-8 h-8 rounded-xl bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300 flex items-center justify-center">
                      <Wallet size={15} />
                    </span>
                    {isEn ? 'Fee collection — this month' : 'ফি আদায় — এই মাস'}
                  </span>
                  <span className="text-sm font-black text-[#d97706] dark:text-amber-300">৳{toBn(classFeeReport.paid.toLocaleString())}</span>
                </div>
                <div className="h-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden ml-10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b]" style={{ width: `${classFeeReport.pct}%` }} />
                </div>
                <p className="text-[11px] text-[#8a93a8] ml-10 mt-1.5">
                  {isEn ? 'Expected' : 'ধার্য'} ৳{toBn(classFeeReport.expected.toLocaleString())} — {toBn(classFeeReport.pct)}% {isEn ? 'collected' : 'আদায় হয়েছে'}
                </p>
              </button>
            </div>
          </section>
        )}

        {/* CASHIER: today's income vs expense */}
        {userRole === 'cashier' && (
          <section className={`${cardCls} p-5 space-y-4`}>
            <h3 className="text-sm font-black flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                <Wallet size={15} />
              </span>
              {isEn ? "Today's Accounts" : 'আজকের আয়-ব্যয়'}
            </h3>
            <div className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between text-[12px] font-semibold mb-1.5">
                  <span className="text-[#5b6478] dark:text-slate-400">{isEn ? 'Income (collection)' : 'আয় (আদায়)'}</span>
                  <span className="text-[#059669] dark:text-emerald-300 font-black">+ ৳{toBn(cashierFigures.todayIncome.toLocaleString())}</span>
                </div>
                <div className="h-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: `${Math.round((cashierFigures.todayIncome / cashierBarMax) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[12px] font-semibold mb-1.5">
                  <span className="text-[#5b6478] dark:text-slate-400">{isEn ? 'Expense' : 'ব্যয় (খরচ)'}</span>
                  <span className="text-[#dc2626] dark:text-rose-300 font-black">− ৳{toBn(todayExpense.toLocaleString())}</span>
                </div>
                <div className="h-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#fb7185] to-[#ef4444]" style={{ width: `${Math.round((todayExpense / cashierBarMax) * 100)}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-dashed border-[#e8ecf4] dark:border-white/10">
                <span className="text-xs font-bold">{isEn ? "Today's net" : 'আজকের নিট'}</span>
                <span className={`text-base font-black ${cashierNet >= 0 ? 'text-[#059669] dark:text-emerald-300' : 'text-[#dc2626] dark:text-rose-300'}`}>
                  ৳{toBn(cashierNet.toLocaleString())}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* CASHIER: recent collections */}
        {userRole === 'cashier' && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <h3 className="text-sm font-black">{isEn ? 'Recent Collections' : 'সাম্প্রতিক আদায়'}</h3>
            {cashierFigures.recent.length === 0 ? (
              <p className="text-xs text-[#8a93a8] font-medium py-2">{isEn ? 'No collections yet.' : 'এখনো কোনো আদায়ের রেকর্ড নেই।'}</p>
            ) : (
              <div className="space-y-2.5">
                {cashierFigures.recent.map((t, i) => (
                  <div key={(t as any).id || i} className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Receipt size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate">{(t as any).studentNameBn || (t as any).studentName || (t as any).description || (isEn ? 'Fee collection' : 'ফি আদায়')}</p>
                      <p className="text-[11px] text-[#8a93a8]">{(t as any).voucherNo ? `${(t as any).voucherNo} • ` : ''}{toBn(String(t.date || '').slice(0, 10))}</p>
                    </div>
                    <span className="text-[13px] font-black text-[#059669] dark:text-emerald-300 shrink-0">৳{toBn((Number(t.amount) || 0).toLocaleString())}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* CASHIER: top dues with one-tap tagada */}
        {userRole === 'cashier' && topDueProfiles.length > 0 && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <h3 className="text-sm font-black flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 flex items-center justify-center">
                <TrendingUp size={15} />
              </span>
              {isEn ? 'Top Dues — follow up' : 'সর্বোচ্চ বকেয়া — তাগাদা দিন'}
            </h3>
            <div className="space-y-2.5">
              {topDueProfiles.map(p => (
                <div key={p.student.id} className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full brand-grad text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
                    {(p.student.nameBn || p.student.name || 'শ').charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">{p.student.nameBn || p.student.name}</p>
                    <p className="text-[11px] text-[#8a93a8]">{p.student.classLevel || ''}</p>
                  </div>
                  <span className="text-[13px] font-black text-[#dc2626] dark:text-rose-300 shrink-0">৳{toBn(p.dueThisMonth.toLocaleString())}</span>
                  {/* Phase 2: one-tap Collect reuses the existing collect
                      flow (preselects the student, same receipt path). */}
                  {canCollectFees && (
                    <button
                      onClick={() => { handleSelectFeeStudent(p); handleOpenModule('cashier_collect'); }}
                      className="px-3 h-9 rounded-full bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-all cursor-pointer"
                    >
                      <Wallet size={13} />
                      {isEn ? 'Collect' : 'আদায়'}
                    </button>
                  )}
                  {p.guardianPhone && (
                    <>
                      <a
                        href={whatsappLink(p)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="WhatsApp reminder"
                        className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
                      >
                        <MessageCircle size={15} />
                      </a>
                      <a
                        href={`tel:${p.guardianPhone}`}
                        aria-label="Call guardian"
                        className="w-9 h-9 rounded-full bg-[#dbeafe] dark:bg-blue-500/15 text-[#2563eb] dark:text-blue-300 flex items-center justify-center shrink-0 active:scale-95 transition-all"
                      >
                        <Phone size={15} />
                      </a>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TEACHER: Due report — current month + aging buckets (Tutor
            pattern). Aging comes from the additive calculateFeeAging:
            September's unpaid fee counts from Oct 1, never before. */}
        {userRole === 'teacher' && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 flex items-center justify-center">
                  <Wallet size={15} />
                </span>
                {isEn ? 'Due report' : 'বকেয়া রিপোর্ট'}
              </h3>
              <button
                onClick={() => handleOpenModule('teacher_students_dues')}
                className="text-[11px] font-bold brand-text flex items-center gap-0.5 cursor-pointer"
              >
                {isEn ? 'See all' : 'সব দেখুন'} <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? 'This month' : 'চলতি মাস'}</p>
                <p className="text-[14px] font-black text-[#dc2626] dark:text-rose-300 mt-1">৳{toBn(classDuesSummary.totalDue.toLocaleString())}</p>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? '1 month old' : '১ মাস আগের'}</p>
                <p className="text-[14px] font-black text-[#d97706] dark:text-amber-300 mt-1">৳{toBn(teacherAging.oneMonthOld.toLocaleString())}</p>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? '2+ months old' : '২+ মাস আগের'}</p>
                <p className="text-[14px] font-black text-[#7c3aed] dark:text-violet-300 mt-1">৳{toBn(teacherAging.twoPlus.toLocaleString())}</p>
              </div>
            </div>
            {teacherAging.agedRows.length === 0 ? (
              <p className="text-xs font-semibold text-[#059669] dark:text-emerald-300 py-1">
                {isEn ? 'No dues from finished months ✓' : 'শেষ হওয়া মাসের কোনো বকেয়া নেই ✓'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {teacherAging.agedRows.slice(0, 5).map(r => {
                  const wa = r.student.guardianPhone ? agedWhatsappLink(r.student, r.aging.totalAged) : null;
                  return (
                    <div key={r.student.id} className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full brand-grad text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
                        {(r.student.nameBn || r.student.name || 'শ').charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold truncate">{r.student.nameBn || r.student.name}</p>
                        <p className="text-[11px] text-[#8a93a8]">
                          {r.student.classLevel}
                          {r.aging.byMonth.length > 0 ? ` • ${isEn ? 'oldest' : 'সবচেয়ে পুরনো'} ${toBn(bnMonthLabel(r.aging.byMonth[0].month))}` : ''}
                        </p>
                      </div>
                      <span className="text-[13px] font-black text-[#dc2626] dark:text-rose-300 shrink-0">৳{toBn(r.aging.totalAged.toLocaleString())}</span>
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="WhatsApp reminder"
                          className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                      {r.student.guardianPhone && (
                        <a
                          href={`tel:${r.student.guardianPhone}`}
                          aria-label="Call guardian"
                          className="w-9 h-9 rounded-full bg-[#dbeafe] dark:bg-blue-500/15 text-[#2563eb] dark:text-blue-300 flex items-center justify-center shrink-0 active:scale-95 transition-all"
                        >
                          <Phone size={15} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TEACHER: attendance per assigned class (only when the teacher
            has more than one class — otherwise the monthly card above
            already covers it). */}
        {userRole === 'teacher' && teacherClasses.length > 1 && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <h3 className="text-sm font-black flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                <BarChart3 size={15} />
              </span>
              {isEn ? 'Attendance by class — this month' : 'প্রতি ক্লাসের হাজিরা — এই মাস'}
            </h3>
            <div className="space-y-3">
              {teacherClassAttendance.map(c => (
                <button
                  key={c.className}
                  onClick={() => handleOpenModule('teacher_report_attendance')}
                  className="w-full text-left cursor-pointer active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center justify-between text-[12px] font-semibold mb-1.5">
                    <span>{c.className}</span>
                    <span className="text-[#059669] dark:text-emerald-300 font-black">{toBn(c.rate)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: `${c.rate}%` }} />
                  </div>
                  <p className="text-[11px] text-[#8a93a8] mt-1">{isEn ? 'School days' : 'কর্মদিবস'} {toBn(c.days)} {isEn ? 'days' : 'দিন'}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* CASHIER: fee collection trend — last 6 months, real INCOME
            rows by receipt date, plus this month's expected vs paid. */}
        {userRole === 'cashier' && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                  <TrendingUp size={15} />
                </span>
                {isEn ? 'Collection trend — 6 months' : 'আদায় ট্রেন্ড — ৬ মাস'}
              </h3>
              <button
                onClick={() => handleOpenModule('finance_reports')}
                className="text-[11px] font-bold brand-text flex items-center gap-0.5 cursor-pointer"
              >
                {isEn ? 'See all' : 'সব দেখুন'} <ChevronRight size={12} />
              </button>
            </div>
            <div className="space-y-2.5">
              {monthlyCollectionTrend.months.map(m => (
                <div key={m.month}>
                  <div className="flex items-center justify-between text-[12px] font-semibold mb-1">
                    <span>{toBn(bnMonthLabel(m.month))}</span>
                    <span className="text-[#059669] dark:text-emerald-300 font-black">৳{toBn(m.collected.toLocaleString())}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: `${Math.round((m.collected / monthlyCollectionTrend.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-dashed border-[#e8ecf4] dark:border-white/10">
              <span className="text-xs font-bold">{isEn ? 'This month: expected' : 'এই মাসে ধার্য'}</span>
              <span className="text-xs font-bold">
                ৳{toBn(monthlyCollectionTrend.thisMonthPaid.toLocaleString())} / ৳{toBn(monthlyCollectionTrend.thisMonthExpected.toLocaleString())}
                {monthlyCollectionTrend.thisMonthExpected > 0 ? ` (${toBn(Math.round((monthlyCollectionTrend.thisMonthPaid / monthlyCollectionTrend.thisMonthExpected) * 100))}%)` : ''}
              </span>
            </div>
          </section>
        )}

        {/* CASHIER: Due report with aging buckets (Tutor pattern). */}
        {userRole === 'cashier' && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 flex items-center justify-center">
                  <Wallet size={15} />
                </span>
                {isEn ? 'Due report' : 'বকেয়া রিপোর্ট'}
              </h3>
              <button
                onClick={() => handleOpenModule('cashier_collect')}
                className="text-[11px] font-bold brand-text flex items-center gap-0.5 cursor-pointer"
              >
                {isEn ? 'See all' : 'সব দেখুন'} <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? 'This month' : 'চলতি মাস'}</p>
                <p className="text-[14px] font-black text-[#dc2626] dark:text-rose-300 mt-1">৳{toBn(allDuesSummary.totalDue.toLocaleString())}</p>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? '1 month old' : '১ মাস আগের'}</p>
                <p className="text-[14px] font-black text-[#d97706] dark:text-amber-300 mt-1">৳{toBn(cashierAging.oneMonthOld.toLocaleString())}</p>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? '2+ months old' : '২+ মাস আগের'}</p>
                <p className="text-[14px] font-black text-[#7c3aed] dark:text-violet-300 mt-1">৳{toBn(cashierAging.twoPlus.toLocaleString())}</p>
              </div>
            </div>
            {cashierAging.agedRows.length === 0 ? (
              <p className="text-xs font-semibold text-[#059669] dark:text-emerald-300 py-1">
                {isEn ? 'No dues from finished months ✓' : 'শেষ হওয়া মাসের কোনো বকেয়া নেই ✓'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {cashierAging.agedRows.slice(0, 5).map(r => {
                  const wa = r.student.guardianPhone ? agedWhatsappLink(r.student, r.aging.totalAged) : null;
                  return (
                    <div key={r.student.id} className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full brand-grad text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
                        {(r.student.nameBn || r.student.name || 'শ').charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold truncate">{r.student.nameBn || r.student.name}</p>
                        <p className="text-[11px] text-[#8a93a8]">
                          {r.student.classLevel}
                          {r.aging.byMonth.length > 0 ? ` • ${isEn ? 'oldest' : 'সবচেয়ে পুরনো'} ${toBn(bnMonthLabel(r.aging.byMonth[0].month))}` : ''}
                        </p>
                      </div>
                      <span className="text-[13px] font-black text-[#dc2626] dark:text-rose-300 shrink-0">৳{toBn(r.aging.totalAged.toLocaleString())}</span>
                      {canCollectFees && r.profile && (
                        <button
                          onClick={() => { handleSelectFeeStudent(r.profile!); handleOpenModule('cashier_collect'); }}
                          className="px-3 h-9 rounded-full bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-all cursor-pointer"
                        >
                          <Wallet size={13} />
                          {isEn ? 'Collect' : 'আদায়'}
                        </button>
                      )}
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="WhatsApp reminder"
                          className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                      {r.student.guardianPhone && (
                        <a
                          href={`tel:${r.student.guardianPhone}`}
                          aria-label="Call guardian"
                          className="w-9 h-9 rounded-full bg-[#dbeafe] dark:bg-blue-500/15 text-[#2563eb] dark:text-blue-300 flex items-center justify-center shrink-0 active:scale-95 transition-all"
                        >
                          <Phone size={15} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* GUARDIAN: per-child report cards — own children ONLY. The
            no-link state above stays exactly as it is. */}
        {userRole === 'parent' && guardianChildReports && guardianChildReports.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2 px-0.5">
              <span className="w-1 h-4 rounded-full brand-bg" />
              {isEn ? 'My children — reports' : 'সন্তানের রিপোর্ট'}
            </h3>
            {guardianChildReports.map(r => {
              const totalDue = r.due.dueThisMonth + (r.aging ? r.aging.totalAged : 0);
              return (
                <button
                  key={r.child.id}
                  onClick={() => { setPortalTabHint('results'); handleOpenModule('guardian_portal'); }}
                  className={`${cardCls} p-5 w-full text-left space-y-3 cursor-pointer active:scale-[0.99] transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl brand-soft flex items-center justify-center font-black text-sm shrink-0">
                      {(r.child.nameBn || r.child.name || 'শ')[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black truncate">{r.child.nameBn || r.child.name}</p>
                      <p className="text-[11px] font-medium text-[#5b6478] dark:text-slate-400">
                        {r.child.classLevel}{r.child.roll ? ` • ${isEn ? 'Roll' : 'রোল'} ${toBn(r.child.roll)}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={15} className="text-[#c3c9d9] shrink-0" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                      <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? 'Attendance' : 'হাজিরা'}</p>
                      <p className="text-[14px] font-black text-[#059669] dark:text-emerald-300 mt-1">
                        {r.recordedDays > 0 ? `${toBn(r.attendanceRate)}%` : (isEn ? 'No record' : 'রেকর্ড নেই')}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                      <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? 'Total due' : 'মোট বকেয়া'}</p>
                      <p className="text-[14px] font-black text-[#dc2626] dark:text-rose-300 mt-1">৳{toBn(totalDue.toLocaleString())}</p>
                      {r.aging && r.aging.totalAged > 0 && (
                        <p className="text-[10px] text-[#8a93a8] mt-0.5">{isEn ? 'incl. old' : 'এর মধ্যে পুরনো'} ৳{toBn(r.aging.totalAged.toLocaleString())}</p>
                      )}
                    </div>
                    <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                      <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? 'Latest exam' : 'সর্বশেষ পরীক্ষা'}</p>
                      <p className="text-[14px] font-black brand-text mt-1">
                        {!r.exam ? (isEn ? 'No exam' : 'পরীক্ষা হয়নি')
                          : !r.examRes || !r.examRes.has ? (isEn ? 'No marks' : 'নম্বর নেই')
                          : `GPA ${toBn(r.examRes.gpa.toFixed(2))}${r.examRes.isFail ? (isEn ? ' • Fail' : ' • ফেল') : ''}`}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        )}

        {/* STAFF: students by class + notices as report cards. */}
        {userRole === 'staff' && (
          <>
            <section className={`${cardCls} p-5 space-y-3`}>
              <h3 className="text-sm font-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#dbeafe] dark:bg-blue-500/15 text-[#2563eb] dark:text-blue-300 flex items-center justify-center">
                  <Users size={15} />
                </span>
                {isEn ? 'Students by class' : 'শ্রেণিভিত্তিক শিক্ষার্থী'}
              </h3>
              {staffByClass.length === 0 ? (
                <p className="text-xs text-[#8a93a8] font-medium py-1">{isEn ? 'No active students yet.' : 'এখনো সক্রিয় শিক্ষার্থী নেই।'}</p>
              ) : (
                <div className="space-y-2.5">
                  {staffByClass.map(c => (
                    <button
                      key={c.className}
                      onClick={() => handleOpenModule('mobile_students')}
                      className="w-full text-left cursor-pointer active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center justify-between text-[12px] font-semibold mb-1">
                        <span>{c.className}</span>
                        <span>{toBn(c.count)} {isEn ? 'students' : 'জন'}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full brand-grad"
                          style={{ width: `${Math.round((c.count / Math.max(...staffByClass.map(x => x.count), 1)) * 100)}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className={`${cardCls} p-5 space-y-3`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300 flex items-center justify-center">
                    <Bell size={15} />
                  </span>
                  {isEn ? 'Notice board' : 'নোটিশ বোর্ড'}
                </h3>
                <button
                  onClick={() => handleOpenModule('notice_board')}
                  className="text-[11px] font-bold brand-text flex items-center gap-0.5 cursor-pointer"
                >
                  {isEn ? 'See all' : 'সব দেখুন'} <ChevronRight size={12} />
                </button>
              </div>
              {notices.length === 0 ? (
                <p className="text-xs text-[#8a93a8] font-medium py-1">{isEn ? 'No notices yet.' : 'এখনো কোনো নোটিশ নেই।'}</p>
              ) : (
                <div className="space-y-2">
                  {notices.slice(0, 5).map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleOpenModule('notice_board')}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 text-left active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span className="w-9 h-9 rounded-xl bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300 flex items-center justify-center shrink-0">
                        <Bell size={14} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-bold truncate">{n.title}</span>
                        <span className="block text-[11px] text-[#8a93a8]">{toBn(n.publishDate || (n as any).date || '')}</span>
                      </span>
                      <ChevronRight size={14} className="text-[#c3c9d9] shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* PRINCIPAL: today's report — whole madrasa, recorded-only
            attendance with an honest not-taken state (MadrasaReports
            pattern), real ledger money only. */}
        {userRole === 'principal' && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#dbeafe] dark:bg-blue-500/15 text-[#2563eb] dark:text-blue-300 flex items-center justify-center">
                  <Sun size={15} />
                </span>
                {isEn ? "Today's report" : 'আজকের প্রতিবেদন'}
              </h3>
              <button
                onClick={() => handleOpenModule('finance_reports')}
                className="text-[11px] font-bold brand-text flex items-center gap-0.5 cursor-pointer"
              >
                {isEn ? 'See all' : 'সব দেখুন'} <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? 'Collected' : 'আদায়'}</p>
                <p className="text-[14px] font-black text-[#059669] dark:text-emerald-300 mt-1">৳{toBn(cashierFigures.todayIncome.toLocaleString())}</p>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? 'Expense' : 'খরচ'}</p>
                <p className="text-[14px] font-black text-[#dc2626] dark:text-rose-300 mt-1">৳{toBn(todayExpense.toLocaleString())}</p>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? 'Net' : 'নিট'}</p>
                <p className="text-[14px] font-black mt-1">৳{toBn(cashierNet.toLocaleString())}</p>
              </div>
            </div>
            {principalTodayAttendance.total === 0 ? (
              <p className="text-xs font-semibold text-[#8a93a8] py-1">
                {isEn ? 'No attendance taken today yet.' : 'আজ এখনো হাজিরা নেওয়া হয়নি।'}
              </p>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold">{isEn ? 'Student attendance today' : 'আজ শিক্ষার্থী হাজিরা'}</span>
                <span className="text-xs font-black">
                  {toBn(principalTodayAttendance.rate)}% · {toBn(principalTodayAttendance.present)}/{toBn(principalTodayAttendance.total)}
                </span>
              </div>
            )}
          </section>
        )}

        {/* PRINCIPAL: this month's report — ledger income/expense/net +
            monthly attendance from recorded days only. */}
        {userRole === 'principal' && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#ede9fe] dark:bg-violet-500/15 text-[#6d28d9] dark:text-violet-300 flex items-center justify-center">
                  <BarChart3 size={15} />
                </span>
                {isEn ? "This month's report" : 'এই মাসের প্রতিবেদন'}
              </h3>
              <button
                onClick={() => handleOpenModule('finance_reports')}
                className="text-[11px] font-bold brand-text flex items-center gap-0.5 cursor-pointer"
              >
                {isEn ? 'See all' : 'সব দেখুন'} <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span>{isEn ? 'Income' : 'আয়'}</span>
              <span className="text-[#059669] dark:text-emerald-300 font-black">৳{toBn(principalMonthSummary.income.toLocaleString())}</span>
            </div>
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span>{isEn ? 'Expense' : 'ব্যয়'}</span>
              <span className="text-[#dc2626] dark:text-rose-300 font-black">৳{toBn(principalMonthSummary.expense.toLocaleString())}</span>
            </div>
            <div className="flex items-center justify-between text-[12px] font-black pt-2 border-t border-dashed border-[#e8ecf4] dark:border-white/10">
              <span>{isEn ? 'Net' : 'নিট'}</span>
              <span>৳{toBn(principalMonthSummary.net.toLocaleString())}</span>
            </div>
            {principalMonthSummary.attTotal === 0 ? (
              <p className="text-xs font-semibold text-[#8a93a8] py-1">
                {isEn ? 'No attendance records this month yet.' : 'এই মাসে এখনো হাজিরা রেকর্ড নেই।'}
              </p>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold">{isEn ? 'Monthly attendance (recorded days)' : 'মাসিক হাজিরা (রেকর্ডকৃত দিন)'}</span>
                <span className="text-xs font-black">
                  {toBn(principalMonthSummary.attRate)}% · {toBn(principalMonthSummary.recordedDays)} {isEn ? 'days' : 'দিন'}
                </span>
              </div>
            )}
          </section>
        )}

        {/* PRINCIPAL: Due report with aging buckets (Tutor pattern) over
            all active students — same buckets/rows as the cashier's
            report, same Collect/WhatsApp/call handlers. */}
        {userRole === 'principal' && (
          <section className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 flex items-center justify-center">
                  <Wallet size={15} />
                </span>
                {isEn ? 'Due report' : 'বকেয়া রিপোর্ট'}
              </h3>
              <button
                onClick={() => handleOpenModule('cashier_collect')}
                className="text-[11px] font-bold brand-text flex items-center gap-0.5 cursor-pointer"
              >
                {isEn ? 'See all' : 'সব দেখুন'} <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? 'This month' : 'চলতি মাস'}</p>
                <p className="text-[14px] font-black text-[#dc2626] dark:text-rose-300 mt-1">৳{toBn(allDuesSummary.totalDue.toLocaleString())}</p>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? '1 month old' : '১ মাস আগের'}</p>
                <p className="text-[14px] font-black text-[#d97706] dark:text-amber-300 mt-1">৳{toBn(cashierAging.oneMonthOld.toLocaleString())}</p>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/5 p-3">
                <p className="text-[10px] font-bold text-[#8a93a8]">{isEn ? '2+ months old' : '২+ মাস আগের'}</p>
                <p className="text-[14px] font-black text-[#7c3aed] dark:text-violet-300 mt-1">৳{toBn(cashierAging.twoPlus.toLocaleString())}</p>
              </div>
            </div>
            {cashierAging.agedRows.length === 0 ? (
              <p className="text-xs font-semibold text-[#059669] dark:text-emerald-300 py-1">
                {isEn ? 'No dues from finished months ✓' : 'শেষ হওয়া মাসের কোনো বকেয়া নেই ✓'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {cashierAging.agedRows.slice(0, 5).map(r => {
                  const wa = r.student.guardianPhone ? agedWhatsappLink(r.student, r.aging.totalAged) : null;
                  return (
                    <div key={r.student.id} className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full brand-grad text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
                        {(r.student.nameBn || r.student.name || 'শ').charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold truncate">{r.student.nameBn || r.student.name}</p>
                        <p className="text-[11px] text-[#8a93a8]">
                          {r.student.classLevel}
                          {r.aging.byMonth.length > 0 ? ` • ${isEn ? 'oldest' : 'সবচেয়ে পুরনো'} ${toBn(bnMonthLabel(r.aging.byMonth[0].month))}` : ''}
                        </p>
                      </div>
                      <span className="text-[13px] font-black text-[#dc2626] dark:text-rose-300 shrink-0">৳{toBn(r.aging.totalAged.toLocaleString())}</span>
                      {canCollectFees && r.profile && (
                        <button
                          onClick={() => { handleSelectFeeStudent(r.profile!); handleOpenModule('cashier_collect'); }}
                          className="px-3 h-9 rounded-full bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-all cursor-pointer"
                        >
                          <Wallet size={13} />
                          {isEn ? 'Collect' : 'আদায়'}
                        </button>
                      )}
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="WhatsApp reminder"
                          className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                      {r.student.guardianPhone && (
                        <a
                          href={`tel:${r.student.guardianPhone}`}
                          aria-label="Call guardian"
                          className="w-9 h-9 rounded-full bg-[#dbeafe] dark:bg-blue-500/15 text-[#2563eb] dark:text-blue-300 flex items-center justify-center shrink-0 active:scale-95 transition-all"
                        >
                          <Phone size={15} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Next-task nudge (all roles) */}
        <section className={`${cardCls} p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300 flex items-center justify-center shrink-0">
            <FileText size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold">{userRole === 'principal' ? (isEn ? 'Principal diary' : 'অধ্যক্ষের ডায়েরি') : roleStats.nextTaskTime}</p>
          </div>
        </section>

        <button
          onClick={() => (onLogout ? onLogout() : logoutAdmin())}
          className="w-full py-3.5 rounded-[20px] bg-white dark:bg-[#161c2e] border border-rose-200 dark:border-rose-500/20 text-[#dc2626] dark:text-rose-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
        >
          <LogOut size={16} />
          <span>{isEn ? 'Logout / Switch account' : 'লগআউট / একাউন্ট পরিবর্তন'}</span>
        </button>
      </ServerDataGate>
      </main>

      {BottomNav}
      {MoreSheet}
      <OfflineIndicator />
    </div>
  );
};
