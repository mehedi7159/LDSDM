import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { UnconfirmedBadge } from '../ui/UnconfirmedBadge';
import {
  Users,
  UserCheck,
  UserPlus,
  Briefcase,
  Calendar, 
  CreditCard, 
  Clock, 
  Printer, 
  Phone, 
  Mail, 
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Check,
  X, 
  Save, 
  Copy, 
  FileText, 
  Award, 
  BarChart3, 
  Layers, 
  QrCode, 
  Sparkles,
  Send,
  Building2,
  CalendarCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { formatNumber, formatBanglaNumber } from '../../services/utils';
import { SubjectManager } from '../SubjectManager';
import { DailyAttendanceHub } from '../attendance/DailyAttendanceHub';
import { TeacherSalaryEntry } from '../finance/TeacherSalaryEntry';
import { AcademicTeacher } from '../../types/academic';
import { FinanceTransaction, UserRole, StaffLeaveRecord, AppUser } from '../../types';
import { resolveApprovalRoleId, resolveStaffRole, roleLabelBn, DESIGNATION_OPTIONS, DESIGNATION_OTHER, isMappedDesignation } from '../../services/staffRole';
import { deleteInstitutionMembers } from '../../services/rbac';
import { STAFF_CLOUD_FAILURE_MESSAGE, LEAVE_CLOUD_FAILURE_MESSAGE, SALARY_CLOUD_FAILURE_MESSAGE } from '../../services/cloudConfirm';
import { decideStaffLeave } from '../../services/staffSelfService';
import { PageHeader } from '../ui/PageHeader';
import { ServerUnavailablePanel } from '../ui/ServerDataGate';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export type StaffSubTab =
  | 'directory'
  | 'assignments' 
  | 'attendance' 
  | 'payroll' 
  | 'id_cards' 
  | 'analytics';

// StaffLeaveRecord is defined in ../../types (shared with AppContext,
// which keeps the records in the cloud-synced store).

interface StaffManagerProps {
  initialSubTab?: StaffSubTab;
  onNavigateTab?: (tab: string) => void;
}

// Leave records are stored centrally in AppContext (staffLeaves).

export const StaffManager: React.FC<StaffManagerProps> = ({
  initialSubTab = 'directory',
  onNavigateTab
}) => {
  const { 
    teachers = [], 
    setTeachers,
    addTeacher,
    updateTeacher,
    confirmStaffCloudSync,
    deleteTeacher,
    staffLeaves = [],
    setStaffLeaves,
    confirmLeavesCloudSync,
    confirmFeeCloudSync,
    dailyStaffAttendance = [],
    users = [], 
    setUsers,
    pendingMembers = [],
    pendingMembersError = null,
    approveMember,
    rejectMember,
    refreshPendingMembers,
    classes = [], 
    subjects = [], 
    transactions = [], 
    addTransaction, 
    schoolProfile, 
    language, 
    t, 
    hasPermission, 
    isOwnerAdmin, 
    isAdmin, 
    isSuperAdmin,
    currentUser,
    currentMember,
    cloudHydrated,
    cloudHydrationTimedOut,
    isRecordUnconfirmed
  } = useApp();

  const isBn = language === 'bn';

  // First-snapshot gate (Nov 2026 stale-flash fix): until the first
  // main_store snapshot lands (or the 6s timeout elapses), the staff
  // list below must NOT render localStorage rows as if current.
  // After the timeout, local data renders WITH the stale banner below.
  const staffListSyncing = !cloudHydrated && !cloudHydrationTimedOut;
  const staffListStale = !cloudHydrated && cloudHydrationTimedOut;
  // P2 (sync hardening): even behind the first-snapshot gate, records
  // whose payload sits in the queue stay visible — badged, never passed
  // for cloud truth. Every other row stays hidden exactly as before.
  const gatedQueuedTeachers = teachers.filter(
    (t) => isRecordUnconfirmed('teachers', t.id) || isRecordUnconfirmed('users', t.id)
  );
  // P2 gated list: compact cards for queued records only (no search,
  // filter, edit or delete here — the full directory owns those once
  // the gate lifts). The UnconfirmedBadge ('cloud-এ যায়নি') plus the
  // local-only mark are what keep the server-only rule intact.
  const gatedQueuedList = gatedQueuedTeachers.length > 0 ? (
    <div className="space-y-3">
      {gatedQueuedTeachers.map((staff) => (
        <div key={staff.id} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-amber-300 dark:border-amber-700 space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg">
              {(staff.nameBn || staff.name || 'উ')[0]}
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                {isBn ? (staff.nameBn || staff.name) : staff.name}
              </h4>
              <UnconfirmedBadge isBn={isBn} />
              <span className="inline-block mt-1 ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {isBn ? 'শুধু এই ডিভাইসে' : 'This device only'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {staff.designation || 'সহকারী শিক্ষক'}{staff.phone || staff.email ? ` • ${staff.phone || staff.email}` : ''}
          </p>
        </div>
      ))}
    </div>
  ) : null;
  const [activeTab, setActiveTab] = useState<StaffSubTab>(initialSubTab);
  // Design গ (merged tab): 'attendance' holds two inner sections —
  // daily attendance + leave records. Admin tier sees both; other
  // attendance viewers see only হাজিরা (ছুটি stays admin-only, as before).
  const [attendanceSection, setAttendanceSection] = useState<'attendance' | 'leaves'>('attendance');

  // Search and filter for Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'INACTIVE'>('ALL');
  // Phase 4: merged directory view — cards (main) or table (toggle).
  const [directoryView, setDirectoryView] = useState<'cards' | 'table'>('cards');

  // Add/Edit Teacher Modal
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<AcademicTeacher | null>(null);
  const [formLoginRole, setFormLoginRole] = useState<UserRole>('teacher');
  // Multi-role: extra roles held alongside the primary login role
  // (e.g. an accountant who also teaches). Saved to the staff record,
  // the linked login account and the member document together.
  const [formAdditionalRoles, setFormAdditionalRoles] = useState<UserRole[]>([]);
  // Phase 3: designation SELECT state. Mapped option value, or
  // DESIGNATION_OTHER when the stored designation is legacy free text
  // (then the text input below holds the custom title; the role still
  // comes from the explicit Login Role select, never from free text).
  const [formDesignationSelect, setFormDesignationSelect] = useState<string>(DESIGNATION_OPTIONS[0].value);
  const [teacherFormData, setTeacherFormData] = useState<Partial<AcademicTeacher>>({
    name: '',
    nameBn: '',
    employeeCode: '',
    designation: 'মুয়াল্লিম (সহকারী শিক্ষক)',
    phone: '',
    email: '',
    password: '',
    status: 'ACTIVE',
    assignedClasses: [],
    assignedSubjects: []
  });
  // Phase 2 field-level errors: duplicate code / invalid email stay
  // under the field until fixed — never only a 3.5s toast.
  const [formErrors, setFormErrors] = useState<{ employeeCode?: string; email?: string; designation?: string; phone?: string; password?: string }>({});
  const employeeCodeInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Leave Management State — records live in the shared, cloud-synced store
  // (AppContext staffLeaves) so they survive across devices and admins.
  const leaves = staffLeaves;
  const setLeaves = setStaffLeaves;

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  // Phase 5: leave-add failure keeps the modal open with this error +
  // a re-confirm-only retry (never a second record).
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [newLeaveData, setNewLeaveData] = useState<Partial<StaffLeaveRecord>>({
    teacherId: '',
    leaveType: 'CASUAL',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    daysCount: 1,
    reason: '',
    status: 'APPROVED'
  });

  // Phase 4/5: demo-clear (moved from Tab 2): owner-gated, cloud
  // confirmed, member cleanup after confirm, truthful result.
  const [showDemoClearConfirm, setShowDemoClearConfirm] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);

  // ID Card Generation Selection
  const [selectedTeacherForIdCard, setSelectedTeacherForIdCard] = useState<AcademicTeacher | null>(null);
  const [idCardFilterClass, setIdCardFilterClass] = useState<string>('ALL');

  // Certificate / NOC Generation
  const [certificateTeacher, setCertificateTeacher] = useState<AcademicTeacher | null>(null);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [certificateType, setCertificateType] = useState<'EXPERIENCE' | 'APPOINTMENT' | 'NOC'>('EXPERIENCE');

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Receipt Modal State for Salary
  const [salaryReceiptTx, setSalaryReceiptTx] = useState<FinanceTransaction | null>(null);

  // Phase 1 live notice: refresh the pending list every time HR opens,
  // so an approval made elsewhere (or a fresh application) is never
  // missed — the realtime members listener in AppContext covers
  // changes while HR stays open.
  useEffect(() => {
    refreshPendingMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Staff removal (confirm dialog) + per-card password reveal
  const [staffToDelete, setStaffToDelete] = useState<AcademicTeacher | null>(null);
  // Phase 2: rejecting an application confirms first (previously the
  // reject buttons called rejectMember directly, no dialog at all).
  const [applicantToReject, setApplicantToReject] = useState<AcademicTeacher | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);
  const [revealedPwId, setRevealedPwId] = useState<string | null>(null);

  const handleDeleteStaff = async () => {
    if (!staffToDelete || isDeletingStaff) return;
    setIsDeletingStaff(true);
    try {
      const res = await deleteTeacher(staffToDelete.id);
      showToast(res.message || (res.success
        ? (isBn ? 'সফলভাবে মুছে ফেলা হয়েছে' : 'Removed successfully')
        : (isBn ? 'মুছতে সমস্যা হয়েছে' : 'Could not remove')));
      if (res.success) setStaffToDelete(null);
    } finally {
      setIsDeletingStaff(false);
    }
  };

  // Today's staff attendance data — Phase 5: reactive to context
  // arrivals, not only the date string. Cloud hydration lands in
  // dailyStaffAttendance (AppContext), so the KPI + attendance tab
  // recompute the moment new records arrive mid-session.
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayStaffAttendance = useMemo(() => {
    return dailyStaffAttendance.filter(r => r.date === todayStr);
  }, [todayStr, dailyStaffAttendance]);

  // Unified Staff list (Phase 1): ACTIVE/INACTIVE staff only — teachers
  // plus staff-role login accounts. Pending applicants are NOT in
  // this list anymore: they live only in the pending-applicants strip
  // below (approve + reject, no edit/delete), so nobody unapproved
  // can appear in the teacher list.
  const unifiedStaffList = useMemo(() => {
    const list: AcademicTeacher[] = teachers.filter(t =>
      (t.status || 'ACTIVE').toUpperCase() !== 'PENDING'
    );
    // If teachers are empty or users have staff not in teachers, complement
    users.forEach(u => {
      if (u.status === 'pending') return; // pending applicants: strip only
      if ((u.role === 'teacher' || u.role === 'staff' || u.role === 'accountant' || u.role === 'principal') && !list.some(t =>
        t.id === u.id || t.userId === u.id ||
        (u.email && t.email?.toLowerCase() === u.email.toLowerCase()) ||
        (u.phone && t.phone === u.phone)
      )) {
        list.push({
          id: u.id,
          name: u.name,
          nameBn: u.nameBn,
          designation: u.designation || (u.role === 'principal' ? 'অধ্যক্ষ / সুপারিনটেনডেন্ট' : u.role === 'accountant' ? 'হিসাবরক্ষক' : u.role === 'staff' ? 'অফিস কর্মী' : 'সহকারী শিক্ষক'),
          phone: u.phone,
          email: u.email,
          password: (u as any).password,
          additionalRoles: (u.additionalRoles || []) as string[],
          status: (u.status === 'blocked' || u.status === 'inactive') ? 'INACTIVE' : 'ACTIVE',
          assignedClasses: u.assignedClasses || []
        });
      }
    });

    return list;
  }, [teachers, users]);

  // Pending applicants, kept strictly separate from the directory:
  // pending member applications + pending login accounts + legacy
  // PENDING teacher records, deduplicated by id/email. These cards
  // get approve + reject ONLY — never edit or delete.
  const pendingStaffApprovals = useMemo(() => {
    const list: AcademicTeacher[] = [];
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    const pushUnique = (rec: AcademicTeacher) => {
      const idKey = rec.id || '';
      const emailKey = (rec.email || '').toLowerCase();
      if ((idKey && seenIds.has(idKey)) || (emailKey && seenEmails.has(emailKey))) return;
      if (idKey) seenIds.add(idKey);
      if (emailKey) seenEmails.add(emailKey);
      list.push(rec);
    };
    pendingMembers.forEach(m => {
      pushUnique({
        id: m.uid,
        name: m.displayName || 'Teacher',
        nameBn: m.displayName || 'শিক্ষক',
        designation: m.requestedRole || 'মুয়াল্লিম (সহকারী শিক্ষক)',
        phone: m.phone || '',
        email: m.email || '',
        status: 'PENDING',
        assignedClasses: m.assignedClasses || [],
        assignedSubjects: m.assignedSubjects || []
      });
    });
    users.forEach(u => {
      if (u.status !== 'pending') return;
      pushUnique({
        id: u.id,
        name: u.name,
        nameBn: u.nameBn,
        designation: u.designation || (u.role === 'accountant' ? 'হিসাবরক্ষক' : u.role === 'staff' ? 'অফিস কর্মী' : 'সহকারী শিক্ষক'),
        phone: u.phone || '',
        email: u.email || '',
        status: 'PENDING',
        assignedClasses: u.assignedClasses || [],
        assignedSubjects: u.assignedSubjects || []
      });
    });
    teachers.forEach(t => {
      if ((t.status || '').toUpperCase() !== 'PENDING') return;
      pushUnique({ ...t, status: 'PENDING' });
    });
    return list;
  }, [pendingMembers, users, teachers]);

  // Real-time KPI Calculations — ACTIVE staff only (Phase 1): pending
  // applicants must never inflate the teacher/staff counts.
  const kpis = useMemo(() => {
    const activeStaff = unifiedStaffList.filter(s =>
      (s.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    );
    const totalStaffCount = activeStaff.length;
    // Phase 3: KPI role comes from the linked account (role +
    // additionalRoles), never from designation substring matching.
    const teachersOnlyCount = activeStaff.filter(s => {
      const r = resolveStaffRole(s, users);
      return r.role === 'teacher' || r.additionalRoles.includes('teacher');
    }).length;

    const officeStaffCount = totalStaffCount - teachersOnlyCount;
    
    // Attendance rate
    const recordedAttendance = todayStaffAttendance.length;
    const presentStaff = todayStaffAttendance.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    const staffAttendanceRate = recordedAttendance > 0
      ? Math.round((presentStaff / recordedAttendance) * 100)
      : 0;

    // Salary disbursed this month
    const currentMonth = todayStr.substring(0, 7);
    const monthlySalaryTx = transactions.filter(tx => 
      tx.type === 'EXPENSE' && 
      (tx.category === 'SALARY' || tx.description?.includes('বেতন') || tx.categoryBn?.includes('বেতন')) &&
      tx.date.startsWith(currentMonth)
    );
    const totalDisbursed = monthlySalaryTx.reduce((sum, tx) => sum + tx.amount, 0);
    // Real per-person average from this month's actual salary payments —
    // replaces a hard-coded "average salary" figure that was shown before.
    const paidStaffCount = new Set(monthlySalaryTx.map(tx => tx.staffName || tx.description || tx.id)).size;
    const avgSalary = paidStaffCount > 0 ? Math.round(totalDisbursed / paidStaffCount) : 0;

    // Active leaves today
    const leavesTodayCount = leaves.filter(l => 
      l.status === 'APPROVED' && 
      l.startDate <= todayStr && 
      l.endDate >= todayStr
    ).length;

    // Phase 5: monthly approved leaves = APPROVED rows whose startDate
    // falls inside the current month (never leaves.length — that
    // counted every status and every month). Reuses the currentMonth
    // declared above for the salary block.
    const [y, m] = currentMonth.split('-').map(Number);
    const monthStart = `${currentMonth}-01`;
    const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().split('T')[0];
    const monthlyApprovedLeavesCount = leaves.filter(l =>
      l.status === 'APPROVED' &&
      l.startDate >= monthStart &&
      l.startDate <= monthEnd
    ).length;

    return {
      totalStaffCount,
      teachersOnlyCount,
      officeStaffCount,
      staffAttendanceRate,
      attendanceRecorded: recordedAttendance > 0,
      presentToday: presentStaff,
      totalDisbursed,
      paidStaffCount,
      avgSalary,
      leavesTodayCount,
      monthlyApprovedLeavesCount
    };
  }, [unifiedStaffList, users, todayStaffAttendance, transactions, todayStr, leaves]);

  // Filtered staff for directory
  const filteredStaff = useMemo(() => {
    return unifiedStaffList.filter(s => {
      const matchSearch = !searchQuery || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.nameBn && s.nameBn.includes(searchQuery)) ||
        (s.employeeCode && s.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.phone && s.phone.includes(searchQuery)) ||
        (s.designation && s.designation.includes(searchQuery));
      
      const matchStatus = statusFilter === 'ALL' || (s.status || 'ACTIVE').toUpperCase() === statusFilter;
      // Phase 3: role filter uses the linked account role +
      // additionalRoles; designation text never decides the filter.
      const resolvedRole = resolveStaffRole(s, users);
      const matchRole = roleFilter === 'ALL' ||
        resolvedRole.role === roleFilter ||
        resolvedRole.additionalRoles.includes(roleFilter as UserRole);

      return matchSearch && matchStatus && matchRole;
    });
  }, [unifiedStaffList, users, searchQuery, statusFilter, roleFilter]);

  // Handle open add modal
  // Phase 2: next code = max existing numeric suffix + 1 — the old
    // length+1 reused a deleted code whenever the list shrank.
    const nextEmployeeCode = () => {
      let max = 0;
      unifiedStaffList.forEach(s => {
        const m = (s.employeeCode || '').match(/(\d+)\s*$/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      return `MDR-T${String(max + 1).padStart(3, '0')}`;
    };

  const handleOpenAddModal = () => {
    setEditingTeacher(null);
    setFormLoginRole('teacher');
    setFormAdditionalRoles([]);
    setFormDesignationSelect(DESIGNATION_OPTIONS[0].value);
    setFormErrors({});
    setTeacherFormData({
      name: '',
      nameBn: '',
      employeeCode: nextEmployeeCode(),
      designation: 'মুয়াল্লিম (সহকারী শিক্ষক)',
      phone: '',
      email: '',
      password: '',
      status: 'ACTIVE',
      assignedClasses: [],
      assignedSubjects: []
    });
    setIsAddEditModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEditModal = (teacher: AcademicTeacher) => {
    setEditingTeacher(teacher);
    const linkedUser = (users || []).find(u =>
      u.id === teacher.id ||
      (teacher.email && u.email?.toLowerCase() === teacher.email.toLowerCase()) ||
      (teacher.phone && u.phone === teacher.phone)
    );
    // Phase 3: single role rule — linked account first, fixed
    // designation mapping second, legacy fallback flagged (the card
    // shows the verify mark; the form lets the admin fix it).
    const primaryRole = resolveStaffRole(teacher, users).role;
    setFormLoginRole(primaryRole);
    // Phase 3: designation select follows the stored value — mapped
    // option, or "other" with the legacy text kept for hand-fixing.
    setFormDesignationSelect(
      teacher.designation && isMappedDesignation(teacher.designation)
        ? teacher.designation
        : (teacher.designation ? DESIGNATION_OTHER : DESIGNATION_OPTIONS[0].value)
    );
    const storedAdditional =
      (linkedUser?.additionalRoles && linkedUser.additionalRoles.length > 0)
        ? linkedUser.additionalRoles
        : ((teacher.additionalRoles || []) as UserRole[]);
    setFormAdditionalRoles(storedAdditional.filter(r => r !== primaryRole));
    setFormErrors({});
    setTeacherFormData({
      ...teacher,
      // Edit never prefills a password: blank keeps the old one (29 Oct 2026).
      password: ''
    });
    setIsAddEditModalOpen(true);
  };

  // Firebase sync failure note for the edit-save toast (Bangla/English).
  const syncFailureNote = (reason: string, bn: boolean): string => {
    if (!bn) return reason;
    switch (reason) {
      case 'service-account-missing': return 'server-এ service account সেট করা নেই';
      case 'admin-not-signed-in': return 'admin Firebase login-এ নেই';
      case 'not-authorized': return 'এই কাজের অনুমতি নেই';
      case 'target-protected': return 'এই অ্যাকাউন্ট পরিবর্তন করা যাবে না';
      case 'user-not-found': return 'Firebase-এ এই staff-এর অ্যাকাউন্ট নেই';
      default: return 'আবার চেষ্টা করুন';
    }
  };

  // Plain-language confirm failure (7 Nov 2026 Job 3): a timeout (slow
  // connection) says so explicitly instead of the generic cloud message
  // — a generic message after a long silent wait is what made the Save
  // button look dead. Mirrors the student form.
  const confirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the save did not finish. Try again on a better connection.')
      : (isBn ? STAFF_CLOUD_FAILURE_MESSAGE : 'Staff information saved on this device, but not yet in cloud — check internet/login and retry.'));

  // Handle save teacher
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    // Creation guard (public signup removed): only super_admin +
    // principal may ADD a record. Anyone else reaching submit gets
    // an honest denial — never a crash, never a silent success.
    // Edit of an existing record passes through untouched.
    if (!editingTeacher && !canCreateStaff) {
      showToast(isBn ? 'শুধু সুপার অ্যাডমিন ও অধ্যক্ষ নতুন অ্যাকাউন্ট তৈরি করতে পারবেন' : 'Only super admin and principal can create new accounts');
      return;
    }
    if (!teacherFormData.name?.trim()) {
      showToast(isBn ? 'দয়া করে শিক্ষকের নাম প্রদান করুন' : 'Please provide staff name');
      return;
    }

    // Phase 3: "other" designation needs its custom title typed —
    // an empty custom title saves nothing (the role still comes from
    // the explicit Login Role select, never from this text).
    if (formDesignationSelect === DESIGNATION_OTHER && !(teacherFormData.designation || '').trim()) {
      setFormErrors(prev => ({ ...prev, designation: isBn ? 'অন্যান্য পদবি লিখুন অথবা তালিকা থেকে বাছুন' : 'Type the custom designation or pick from the list' }));
      showToast(isBn ? 'পদবি বাছুন অথবা অন্যান্য পদবির নাম লিখুন' : 'Pick a designation or type the custom title');
      return;
    }

    // Phase 2 field-level validation: duplicate code / invalid email
    // stay under the field until fixed — never only a 3.5s toast.
    // Nov 2026 (bug-free add form): duplicate email/phone, phone
    // format, password length and the email-or-phone login contact
    // are validated here too — never a silent overwrite, never a
    // record that cannot log in.
    const code = (teacherFormData.employeeCode || '').trim();
    const emailVal = (teacherFormData.email || '').trim();
    const phoneVal = (teacherFormData.phone || '').trim();
    const phoneDigits = phoneVal.replace(/[^0-9]/g, '');
    const fieldErrs: { employeeCode?: string; email?: string; phone?: string; password?: string } = {};
    if (code) {
      const dup = unifiedStaffList.some(s =>
        s.id !== editingTeacher?.id &&
        (s.employeeCode || '').trim().toLowerCase() === code.toLowerCase()
      );
      if (dup) fieldErrs.employeeCode = isBn ? 'এই কর্মী কোড ইতিমধ্যে ব্যবহৃত হয়েছে' : 'This employee code is already in use';
    }
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      fieldErrs.email = isBn ? 'সঠিক ইমেইল ঠিকানা দিন' : 'Enter a valid email address';
    }
    if (emailVal && !fieldErrs.email) {
      const dupEmail = unifiedStaffList.some(s =>
        s.id !== editingTeacher?.id &&
        (s.email || '').trim().toLowerCase() === emailVal.toLowerCase()
      ) || users.some(u =>
        u.id !== editingTeacher?.id &&
        (u.email || '').trim().toLowerCase() === emailVal.toLowerCase()
      );
      if (dupEmail) fieldErrs.email = isBn ? 'এই ইমেইল ইতিমধ্যে অন্য স্টাফের সাথে যুক্ত আছে' : 'This email is already linked to another staff member';
    }
    if (phoneVal) {
      if (!(phoneDigits.length === 11 && phoneDigits.startsWith('01'))) {
        fieldErrs.phone = isBn ? 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (01XXXXXXXXX)' : 'Enter a valid 11-digit mobile number (01XXXXXXXXX)';
      } else {
        const dupPhone = unifiedStaffList.some(s =>
          s.id !== editingTeacher?.id &&
          (s.phone || '').replace(/[^0-9]/g, '') === phoneDigits
        ) || users.some(u =>
          u.id !== editingTeacher?.id &&
          (u.phone || '').replace(/[^0-9]/g, '') === phoneDigits
        );
        if (dupPhone) fieldErrs.phone = isBn ? 'এই মোবাইল নম্বর ইতিমধ্যে অন্য স্টাফের সাথে যুক্ত আছে' : 'This phone number is already linked to another staff member';
      }
    }
    if (!emailVal && !phoneVal) {
      fieldErrs.email = isBn ? 'লগইনের জন্য ইমেইল বা মোবাইল — অন্তত একটি দিন' : 'Provide an email or a phone number for login';
    }
    const typedPasswordEarly = (teacherFormData.password || '').trim();
    if ((!editingTeacher && typedPasswordEarly.length < 6) || (editingTeacher && typedPasswordEarly && typedPasswordEarly.length < 6)) {
      fieldErrs.password = isBn ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters';
    }
    if (fieldErrs.employeeCode || fieldErrs.email || fieldErrs.phone || fieldErrs.password) {
      setFormErrors(fieldErrs);
      if (fieldErrs.employeeCode) employeeCodeInputRef.current?.focus();
      else if (fieldErrs.email) emailInputRef.current?.focus();
      else if (fieldErrs.phone) phoneInputRef.current?.focus();
      else passwordInputRef.current?.focus();
      return;
    }
    setFormErrors({});

    // Edit must never force a password: blank keeps the record's old
    // password (29 Oct 2026 — the form used to prefill '123' and a save
    // silently reset the account's password to it). Add still needs one.
    const typedPassword = teacherFormData.password?.trim() || '';
    if (!editingTeacher && !typedPassword) {
      showToast(isBn ? 'নতুন অ্যাকাউন্টের জন্য লগইন পাসওয়ার্ড দিন' : 'Enter a login password for the new account');
      return;
    }
    const passwordToSave = editingTeacher ? (typedPassword || editingTeacher.password || '') : typedPassword;

    const additionalRoles = formAdditionalRoles.filter(r => r !== formLoginRole);

    if (editingTeacher) {
      // 7 Nov 2026 Job 3 (instant save): the old code block-awaited the
      // cloud confirm — getDoc of the full ~341 KB main_store + setDoc
      // of the full teachers + users lists — so one click sat for
      // 60-90s on a slow connection. Now the local mutation applies at
      // once (updateTeacher sets the lists synchronously, before its
      // credential-sync await) and the modal closes AT ONCE; the
      // confirm runs in the BACKGROUND via the same
      // confirmStaffCloudSync (90s timeout, raw error text). On failure
      // it queues the payload, the record shows the amber
      // 'cloud-এ যায়নি' badge, and the Diagnostics queue can retry
      // it. Modal closing means 'saved on this device, syncing' —
      // never a false 'saved to cloud'.
      const syncPromise = updateTeacher({
        ...editingTeacher,
        ...teacherFormData,
        name: teacherFormData.name.trim(),
        nameBn: teacherFormData.nameBn?.trim() || teacherFormData.name.trim(),
        password: passwordToSave,
        additionalRoles
      } as AcademicTeacher, formLoginRole);
      setIsAddEditModalOpen(false);
      showToast(isBn ? 'তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…');
      void syncPromise.then((sync) => {
        // Phase 2 edit validation: a payload error must surface — the
        // record was NOT changed (validation runs before the local
        // apply), so this toast is the only signal. The form itself
        // already validates the same rules inline before submit, so
        // this path should almost never fire.
        if (sync.error) {
          showToast(sync.error);
          return;
        }
        // Background confirm — fire and forget from the UI's point of
        // view. On failure confirmStaffCloudSync queues the payload
        // (via confirmUpsertFailure), so the badge appears and the
        // Diagnostics queue can retry it.
        void confirmStaffCloudSync(sync.nextTeachers, sync.nextUsers).then((record) => {
          // Truthful save (Step 2): the credential sync above never
          // covered the main_store record write — the record's cloud
          // status leads the toast (credential status second).
          const credClause = sync.status === 'failed'
            ? (isBn ? ' Firebase sync-ও হয়নি।' : ' Firebase sync also failed.')
            : (sync.status === 'skipped' && sync.reason === 'no-email')
              ? (isBn ? ' Firebase sync হয়নি (email নেই)।' : ' Firebase sync did not run (no email).')
              : '';
          if (!record.success) {
            showToast(`${confirmErrorMessage(record)}${credClause}`);
          } else if (sync.status === 'failed') {
            showToast(isBn ? `তথ্য আপডেট হয়েছে, তবে Firebase sync হয়নি (${syncFailureNote(sync.reason, true)})` : `Information updated, but Firebase sync failed (${sync.reason})`);
          } else if (sync.status === 'skipped' && sync.reason === 'no-email') {
            showToast(isBn ? 'তথ্য আপডেট হয়েছে; এই staff-এর email নেই বলে Firebase sync হয়নি' : 'Information updated; no email, so Firebase sync did not run');
          } else {
            showToast(isBn ? 'শিক্ষক/কর্মচারীর তথ্য সফলভাবে আপডেট হয়েছে' : 'Staff information updated successfully');
          }
        }).catch((err) => {
          console.error('Background staff cloud confirm failed:', err);
          showToast(isBn ? STAFF_CLOUD_FAILURE_MESSAGE : 'Staff information saved on this device, but not yet in cloud — check internet/login and retry.');
        });
      }).catch((err) => {
        console.error('Background staff save failed:', err);
        showToast(isBn ? 'সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।' : 'Could not save — please try again.');
      });
    } else {
      // 7 Nov 2026 Job 3 (instant save): same as the edit branch — the
      // local record applies at once (addTeacher sets the lists and
      // queues the payload synchronously, before its provisioning
      // await) and the modal closes; provisioning + cloud confirm run
      // in the background. A provisioning failure still never blocks
      // creation, and the staff member's next login still retries it.
      const addPromise = addTeacher({
        name: teacherFormData.name.trim(),
        nameBn: teacherFormData.nameBn?.trim() || teacherFormData.name.trim(),
        employeeCode: teacherFormData.employeeCode || `MDR-T${Date.now().toString().slice(-3)}`,
        designation: teacherFormData.designation || 'সহকারী শিক্ষক',
        phone: teacherFormData.phone || '',
        email: teacherFormData.email || '',
        password: passwordToSave,
        status: teacherFormData.status || 'ACTIVE',
        additionalRoles,
        assignedClasses: teacherFormData.assignedClasses || [],
        assignedSubjects: teacherFormData.assignedSubjects || []
      }, formLoginRole);
      setIsAddEditModalOpen(false);
      showToast(isBn ? 'তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…');
      void addPromise.then((addRes) => {
        if (addRes && !addRes.success) {
          showToast(addRes.message || (isBn ? 'যুক্ত করা যায়নি — তথ্য যাচাই করুন' : 'Could not add — please check the information'));
          return;
        }
        // Truthful save (Step 2): the old toast claimed the login
        // account was created even when provisioning failed or was
        // skipped, and never confirmed the record write. Both outcomes
        // are now stated plainly; provisioning itself is unchanged
        // (failure still never blocks creation, next login still
        // retries).
        const provBn = addRes.provisioning === 'synced'
          ? 'লগইন অ্যাকাউন্ট সক্রিয় হয়েছে।'
          : addRes.provisioning === 'failed'
            ? 'লগইন অ্যাকাউন্ট তৈরি হয়নি — কর্মীর পরের লগইনে আবার চেষ্টা হবে।'
            : 'লগইন তথ্য সংরক্ষিত হয়েছে।';
        const provEn = addRes.provisioning === 'synced'
          ? 'Login account activated.'
          : addRes.provisioning === 'failed'
            ? 'Login account could not be created — it will retry on the staff member\'s next login.'
            : 'Login credentials saved.';
        void confirmStaffCloudSync(addRes.nextTeachers, addRes.nextUsers).then((record) => {
          if (!record.success) {
            showToast(isBn
              ? `${confirmErrorMessage(record)} ${provBn}`
              : `${confirmErrorMessage(record)} ${provEn}`);
          } else {
            showToast(isBn ? `নতুন শিক্ষক/কর্মচারী সফলভাবে যুক্ত হয়েছে। ${provBn}` : `New staff member added successfully. ${provEn}`);
          }
        }).catch((err) => {
          console.error('Background staff cloud confirm failed:', err);
          showToast(isBn ? `${STAFF_CLOUD_FAILURE_MESSAGE} ${provBn}` : `Staff information saved on this device, but not yet in cloud — check internet/login and retry. ${provEn}`);
        });
      }).catch((err) => {
        console.error('Background staff add failed:', err);
        showToast(isBn ? 'যুক্ত করা যায়নি — আবার চেষ্টা করুন।' : 'Could not add — please try again.');
      });
    }
  };

  // Approval dialog state (Phase 1): approving a teacher must let the
  // admin pick classes/subjects — the old 1-click approve sent empty
  // arrays, so approved teachers landed with no classes at all.
  const [approvingStaff, setApprovingStaff] = useState<AcademicTeacher | null>(null);
  const [approveClasses, setApproveClasses] = useState<string[]>([]);
  const [approveSubjects, setApproveSubjects] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);

  // Open the approval dialog (single approval path for the pending
  // strip and the directory card): class/subject picks prefilled from
  // the application, role resolved by the shared rule (linked account
  // first, stored roleId second, fixed designation mapping third).
  const handleQuickApproveStaff = (staff: AcademicTeacher) => {
    setApprovingStaff(staff);
    setApproveClasses(staff.assignedClasses || []);
    setApproveSubjects(staff.assignedSubjects || []);
  };

  // Approval cloud-confirm (rank #1 fix, 31 Oct 2026): the confirmed
  // main_store lists must CONTAIN the approved records. The old code
  // confirmed map-only lists built from stale closure state, so a
  // member-only applicant was absent from both lists and the confirm
  // "succeeded" while cloud never received the teacher or the user.
  // Append-if-absent only: updateTeacher already updated any MATCHED
  // record (active status, normalized credentials) — the only gap is
  // absence, and only absence is closed here.
  function appendIfAbsent<T>(list: T[], record: T | undefined, matches: (item: T) => boolean): T[] {
    if (!record) return list;
    return list.some(matches) ? list : [...list, record];
  }

  const handleConfirmApproval = async () => {
    if (!approvingStaff || isApproving) return;
    const staff = approvingStaff;
    setIsApproving(true);
    try {
      let approvedTeacher: AcademicTeacher | undefined;
      let approvedUser: AppUser | undefined;
      if (approveMember) {
        const approvalResult = await approveMember(staff.id, resolveApprovalRoleId(staff, users), approveClasses, approveSubjects);
        // A failed member approval stops here — never a success toast
        // while the application was not actually approved.
        if (!approvalResult.success) {
          showToast(approvalResult.message || (isBn ? 'অনুমোদন সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।' : 'Approval could not be saved — please try again.'));
          return;
        }
        approvedTeacher = approvalResult.approvedTeacher;
        approvedUser = approvalResult.approvedUser;
      }
      const updateResult = await updateTeacher({ ...staff, status: 'ACTIVE', assignedClasses: approveClasses, assignedSubjects: approveSubjects });
      // Phase 2: a validation error must stop approval here — never
      // a success toast while the record stays pending.
      if (updateResult.error) {
        showToast(updateResult.error);
        return;
      }
      // updateTeacher already maps the linked user to 'active' for
      // id/email/phone matches; the approved records are appended
      // only when absent (member-only applicants).
      const mergedUsers = updateResult.nextUsers
        ? updateResult.nextUsers.map(u => (u.id === staff.id || (staff.email && u.email?.toLowerCase() === staff.email.toLowerCase())) ? { ...u, status: 'active' } : u)
        : users.map(u => (u.id === staff.id || (staff.email && u.email?.toLowerCase() === staff.email.toLowerCase())) ? { ...u, status: 'active' } : u);
      const confirmedTeachers = appendIfAbsent(
        updateResult.nextTeachers ?? teachers,
        approvedTeacher,
        t => t.id === approvedTeacher!.id || (approvedTeacher!.email && t.email?.toLowerCase() === approvedTeacher!.email.toLowerCase()) || (approvedTeacher!.phone && t.phone === approvedTeacher!.phone)
      );
      const confirmedUsers = appendIfAbsent(
        mergedUsers,
        approvedUser,
        u => u.id === approvedUser!.id || (approvedUser!.email && u.email?.toLowerCase() === approvedUser!.email.toLowerCase())
      );
      setTeachers(confirmedTeachers);
      setUsers(confirmedUsers);
      try {
        const stored = localStorage.getItem('madrasha_app_users');
        if (stored) {
          const list = JSON.parse(stored);
          const updated = list.map((u: any) => (u.id === staff.id || (staff.email && u.email?.toLowerCase() === staff.email.toLowerCase())) ? { ...u, status: 'active' } : u);
          const finalList = approvedUser && !updated.some((u: any) => u.id === approvedUser!.id || (approvedUser!.email && u.email?.toLowerCase() === approvedUser!.email.toLowerCase())) ? [...updated, approvedUser] : updated;
          localStorage.setItem('madrasha_app_users', JSON.stringify(finalList));
        }
      } catch (e) {}

      if (refreshPendingMembers) {
        await refreshPendingMembers();
      }
      // The confirmed lists are what reaches cloud: success toast
      // ONLY after this write confirms. On failure the 'staff'
      // pending-confirm queue retries on start/foreground/online.
      const confirmResult = await confirmStaffCloudSync(confirmedTeachers, confirmedUsers);
      if (!confirmResult.success) {
        showToast(confirmResult.message || STAFF_CLOUD_FAILURE_MESSAGE);
        return;
      }
      showToast(isBn ? 'শিক্ষকের অ্যাকাউন্ট সফলভাবে অনুমোদন ও সক্রিয় করা হয়েছে!' : 'Staff account approved successfully!');
      setApprovingStaff(null);
    } catch (err: any) {
      showToast(isBn ? 'অনুমোদনে সমস্যা হয়েছে' : 'Approval failed');
    } finally {
      setIsApproving(false);
    }
  };

  // Reject a pending application (pending strip only — never edit or
  // delete on pending cards; rejection removes the application).
  const handleRejectApplicant = async (staff: AcademicTeacher) => {
    try {
      if (rejectMember) {
        const res = await rejectMember(staff.id);
        showToast(res.message || (isBn ? 'আবেদনটি বাতিল করা হয়েছে' : 'Application rejected'));
      }
      if (refreshPendingMembers) {
        await refreshPendingMembers();
      }
    } catch (err: any) {
      showToast(isBn ? 'বাতিল করতে সমস্যা হয়েছে' : 'Could not reject');
    }
  };

  const handleConfirmRejectApplicant = async () => {
    if (!applicantToReject) return;
    await handleRejectApplicant(applicantToReject);
    setApplicantToReject(null);
  };

  // Phase 4/5: demo-clear, moved from the removed Tab 2 into the
  // merged tab. DELIBERATE behavior fix vs the old version: the old
  // button deleted EVERY non-self user when pressed (real staff
  // included). This version removes ONLY demo-pattern accounts
  // (seed ids / @madrasha.local emails) and always keeps super_admin
  // + the signed-in admin. Cloud-confirmed + member cleanup AFTER
  // confirm + truthful result — never a local-only success.
  const isDemoUser = (u: any) =>
    (u.id || '').startsWith('user_teacher_') ||
    (u.id || '').startsWith('user_acc_') ||
    (u.id || '').startsWith('user_staff_') ||
    (u.id || '').startsWith('user_guardian_') ||
    Boolean(u.email && u.email.includes('madrasha.local'));
  const demoUsers = (users || []).filter(isDemoUser);

  const executeClearDemoUsers = async () => {
    setShowDemoClearConfirm(false);
    if (isClearingDemo) return;
    setIsClearingDemo(true);
    try {
      const prevUsers = users;
      const filtered = users.filter(u =>
        u.role === 'super_admin' ||
        (currentUser?.email && u.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser?.id && u.id === currentUser.id) ||
        !isDemoUser(u)
      );
      const removed = users.filter(u => !filtered.some(f => f.id === u.id));
      setUsers(filtered);
      const confirmResult = await confirmStaffCloudSync(undefined, filtered);
      if (!confirmResult.success) {
        setUsers(prevUsers);
        showToast(confirmResult.message || STAFF_CLOUD_FAILURE_MESSAGE);
        return;
      }
      // Member cleanup AFTER the cloud confirm (Phase 2 order rule).
      // Missing member docs delete cleanly, so ok=false here means a
      // real write error — reported, not hidden.
      const memberRes = await deleteInstitutionMembers('inst_madrasah_primary', removed.map(u => u.id));
      try {
        localStorage.setItem('madrasha_app_users', JSON.stringify(filtered));
      } catch (e) {}
      showToast(isBn
        ? `ডেমো অ্যাকাউন্ট ${removed.length}টি মুছে ফেলা হয়েছে।${memberRes.failedUids.length > 0 ? ` member doc ${memberRes.failedUids.length}টি মোছা যায়নি।` : ''}`
        : `Removed ${removed.length} demo accounts.${memberRes.failedUids.length > 0 ? ` ${memberRes.failedUids.length} member docs could not be removed.` : ''}`);
    } catch (err: any) {
      showToast(isBn ? 'ডেমো অ্যাকাউন্ট মুছতে সমস্যা হয়েছে' : 'Could not clear demo accounts');
    } finally {
      setIsClearingDemo(false);
    }
  };

  // Handle add leave — Phase 5: cloud-confirmed like approve/reject.
  // The record stays local on failure (never dropped) and the modal
  // stays open with an inline error + re-confirm-only retry; the
  // 'leaves' auto-retry also delivers it on the next trigger.
  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaveData.teacherId) {
      showToast(isBn ? 'দয়া করে শিক্ষক/কর্মী নির্বাচন করুন' : 'Please select staff');
      return;
    }

    const teacherObj = unifiedStaffList.find(s => s.id === newLeaveData.teacherId);
    if (!teacherObj) return;

    const start = new Date(newLeaveData.startDate || todayStr);
    const end = new Date(newLeaveData.endDate || todayStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const record: StaffLeaveRecord = {
      id: `leave_${Date.now()}`,
      teacherId: teacherObj.id,
      teacherName: teacherObj.nameBn || teacherObj.name,
      designation: teacherObj.designation || 'সহকারী শিক্ষক',
      leaveType: newLeaveData.leaveType || 'CASUAL',
      startDate: newLeaveData.startDate || todayStr,
      endDate: newLeaveData.endDate || todayStr,
      daysCount: isNaN(diffDays) ? 1 : diffDays,
      reason: newLeaveData.reason || '',
      status: newLeaveData.status || 'APPROVED',
      appliedAt: new Date().toISOString(),
      approvedBy: isOwnerAdmin ? 'অধ্যক্ষ / প্রধান' : 'প্রশাসন'
    };

    const next = [record, ...leaves];
    setLeaves(next);
    const result = await confirmLeavesCloudSync(next);
    if (result.success) {
      setLeaveError(null);
      setIsLeaveModalOpen(false);
      showToast(isBn ? 'ছুটির আবেদন সফলভাবে রেকর্ড করা হয়েছে' : 'Leave record added successfully');
    } else {
      // Record stays in the local list (visible in the tab) — the
      // retry below re-confirms the same list, never a second record.
      setLeaveError(result.message || LEAVE_CLOUD_FAILURE_MESSAGE);
    }
  };

  // Phase 5: leave-add retry — re-confirm only, never re-add.
  const handleRetryLeaveSave = async () => {
    const result = await confirmLeavesCloudSync(leaves);
    if (result.success) {
      setLeaveError(null);
      setIsLeaveModalOpen(false);
      showToast(isBn ? 'ছুটির আবেদন সফলভাবে রেকর্ড করা হয়েছে' : 'Leave record added successfully');
    } else {
      setLeaveError(result.message || LEAVE_CLOUD_FAILURE_MESSAGE);
    }
  };

  // Phase 5: leave row-delete — cloud-confirmed; on failure the row
  // comes back (it still exists in cloud, so reverting is truthful).
  const handleDeleteLeave = async (id: string) => {
    const prev = leaves;
    const next = leaves.filter(x => x.id !== id);
    setLeaves(next);
    const result = await confirmLeavesCloudSync(next);
    if (result.success) {
      showToast(isBn ? 'ছুটির রেকর্ড মুছে ফেলা হয়েছে' : 'Leave record removed');
    } else {
      setLeaves(prev);
      showToast(result.message || LEAVE_CLOUD_FAILURE_MESSAGE);
    }
  };

  // Step 4 (25 Oct 2026): approve/reject for STAFF-SUBMITTED (PENDING)
  // requests only. Admin-entered leaves above keep their existing
  // behavior (recorded APPROVED directly). The decision is confirmed
  // against the cloud: on failure the row reverts to PENDING and a
  // failure toast shows — the admin is never told a decision landed
  // when it did not. REJECTED rows stay listed in this tab but are
  // excluded from every report count (reports filter APPROVED only).
  const handleLeaveDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    const target = leaves.find((l) => l.id === id);
    if (!target || target.status !== 'PENDING') return;
    const decidedBy = isOwnerAdmin ? 'অধ্যক্ষ / প্রধান' : 'প্রশাসন';
    const next = decideStaffLeave(leaves, id, decision, decidedBy);
    setLeaves(next);
    const result = await confirmLeavesCloudSync(next);
    if (result.success) {
      showToast(decision === 'APPROVED'
        ? (isBn ? 'ছুটি অনুমোদিত হয়েছে' : 'Leave approved')
        : (isBn ? 'ছুটি বাতিল করা হয়েছে' : 'Leave rejected'));
    } else {
      setLeaves(leaves);
      showToast(result.message || LEAVE_CLOUD_FAILURE_MESSAGE);
    }
  };

  // Sub-tabs list — Phase 4: tabs 1+2 are ONE merged tab
  // ("শিক্ষক, কর্মী ও অ্যাকাউন্ট"). The old Tab 2 (roles/accounts)
  // is gone: its pending approve/reject lives in the pending strip,
  // its user list lives in the merged cards/table, its User form is
  // replaced by the single Staff form, and demo-clear moved here.
  // The name promises no permission editor — none exists in UI.
  const tabs = [
    {
      id: 'directory' as StaffSubTab,
      labelBn: 'স্টাফ',
      labelEn: 'Staff',
      icon: Users,
      badge: `${formatNumber(kpis.totalStaffCount, 'bn')}`
    },
    {
      id: 'assignments' as StaffSubTab,
      labelBn: 'দায়িত্ব',
      labelEn: 'Workload',
      icon: Briefcase
    },
    {
      id: 'attendance' as StaffSubTab,
      labelBn: 'হাজিরা ও ছুটি',
      labelEn: 'Attendance & Leave',
      icon: CalendarCheck,
      badge: kpis.attendanceRecorded ? `${kpis.staffAttendanceRate}%` : '—'
    },
    {
      id: 'payroll' as StaffSubTab,
      labelBn: 'বেতন',
      labelEn: 'Payroll',
      icon: CreditCard
    },
    {
      id: 'id_cards' as StaffSubTab,
      labelBn: 'আইডি',
      labelEn: 'ID Cards',
      icon: Award
    },
    {
      id: 'analytics' as StaffSubTab,
      labelBn: 'রিপোর্ট',
      labelEn: 'Reports',
      icon: BarChart3
    },
  ];

  // Phase 2 tab-bar permission gates (mirrors the App.tsx render
  // gates + Layout menu rules): a teachers.view holder must NOT reach
  // Roles/payroll/leaves/analytics actions. Directory is the entry
  // gate — anyone who reached StaffManager sees it.
  const isAdminTier = isOwnerAdmin || isAdmin || isSuperAdmin || currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal';

  // Account creation is restricted to super_admin + principal ONLY
  // (public signup removed 31 Oct 2026). Other roles never see the
  // Add button, and the add-path submit below refuses with a toast.
  // Edit of an existing record is NOT affected by this guard, and
  // neither is the pending approve/reject flow. The guard covers
  // every designation the form offers, including guardian.
  // Nov 2026 fix: the old guard dropped isOwnerAdmin, and isSuperAdmin
  // needs Firebase custom claims the app never sets (no service
  // account) — so the Add button hid from EVERYONE, including the
  // owner. Owner email IS the super_admin identity, so isOwnerAdmin
  // belongs here. NOT widened to isAdminTier: plain admin roles stay
  // out, per the user's super_admin + principal ONLY rule.
  const canCreateStaff = isOwnerAdmin || isSuperAdmin || currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal';
  const canViewAttendance = isOwnerAdmin || isSuperAdmin || hasPermission('attendance.view') || hasPermission('attendance.create');
  const canViewPayroll = isOwnerAdmin || isSuperAdmin || hasPermission('finance.view');
  const visibleTabs = tabs.filter(tab => {
    switch (tab.id) {
      case 'directory': return true;
      case 'assignments': return isOwnerAdmin || isSuperAdmin || hasPermission('subjects.view') || hasPermission('teachers.view');
      case 'attendance': return canViewAttendance || isAdminTier;
      case 'payroll': return canViewPayroll;
      case 'id_cards': return isAdminTier;
      case 'analytics': return isOwnerAdmin || isSuperAdmin || hasPermission('reports.view');
      default: return true;
    }
  });

  // A gated-out tab (e.g. a stale initialSubTab) falls back to the
  // directory instead of rendering a blank section.
  useEffect(() => {
    if (activeTab !== 'directory' && !visibleTabs.some(t => t.id === activeTab)) {
      setActiveTab('directory');
    }
  }, [activeTab, visibleTabs]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 text-xs font-bold animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Header: Step 7 • Staff & HR Management Suite */}
      <PageHeader
        tone="brand"
        className="print:hidden"
        icon={Users}
        title={isBn ? 'শিক্ষক, কর্মচারী ও মানবসম্পদ (HR) কেন্দ্র' : 'Staff, Faculty & HR Hub'}
        footer={
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'মোট শিক্ষক ও উস্তাদ' : 'Total Teachers'}</div>
            <div className="text-xl font-black text-white mt-0.5">{formatNumber(kpis.teachersOnlyCount, 'bn')} জন</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'কর্মচারী ও অফিস স্টাফ' : 'Office & Staff'}</div>
            <div className="text-xl font-black text-cyan-300 mt-0.5">{formatNumber(kpis.officeStaffCount, 'bn')} জন</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'আজকের স্টাফ উপস্থিতি' : 'Attendance Today'}</div>
            <div className="text-xl font-black text-emerald-300 mt-0.5">{kpis.attendanceRecorded ? `${kpis.staffAttendanceRate}%` : '—'}</div>
            <div className="text-[10px] text-emerald-400/90 font-medium">{kpis.attendanceRecorded ? (isBn ? 'ডিজিটাল লগ সম্পন্ন' : 'Digital Log Active') : (isBn ? 'আজ হাজিরা নেওয়া হয়নি' : 'Not recorded today')}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'মাসিক বেতন বিতরণ' : 'Monthly Payroll'}</div>
            <div className="text-xl font-black text-amber-300 mt-0.5">৳ {formatBanglaNumber(kpis.totalDisbursed)}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'আজকের অনুমোদিত ছুটি' : 'Staff on Leave'}</div>
            <div className="text-xl font-black text-rose-300 mt-0.5">{formatNumber(kpis.leavesTodayCount, 'bn')} জন</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'স্টাফ আইডি কার্ড' : 'Staff ID Cards'}</div>
            <div className="text-xl font-black text-indigo-300 mt-0.5 flex items-center gap-1.5">
              <Award size={18} className="text-indigo-400" />
              <span>{isBn ? 'রেডি' : 'Ready'}</span>
            </div>
          </div>
        </div>
        }
      >
<div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
            {canCreateStaff && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
            >
              <UserPlus size={14} className="text-teal-300" />
              <span>{isBn ? '+ নতুন শিক্ষক যুক্ত' : 'Add Staff'}</span>
            </button>
            )}
            {canViewAttendance && (
            <button
              type="button"
              onClick={() => { setActiveTab('attendance'); setAttendanceSection('attendance'); }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 border border-teal-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CalendarCheck size={14} />
              <span>{isBn ? 'দৈনিক স্টাফ হাজিরা' : 'Staff Attendance'}</span>
            </button>
            )}
            {canViewPayroll && (
            <button
              type="button"
              onClick={() => setActiveTab('payroll')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard size={14} />
              <span>{isBn ? 'বেতন প্রদান' : 'Payroll'}</span>
            </button>
            )}
          </div>
      </PageHeader>

{/* Sub-Tabs Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                <span>{isBn ? tab.labelBn : tab.labelEn}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area based on Active Sub-Tab */}
      <div className="transition-all duration-200">
        {/* 1. Staff, Faculty & Accounts (merged directory + roles) */}
        {activeTab === 'directory' && (
          staffListSyncing ? (
            <>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center gap-3 text-center">
              <div className="h-8 w-8 rounded-full border-2 border-teal-200 border-t-teal-600 animate-spin" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{isBn ? 'সর্বশেষ তথ্য আসছে — পুরোনো তালিকা দেখানো হচ্ছে না' : 'Loading latest data — stale list hidden'}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{isBn ? 'ক্লাউড থেকে নতুন তালিকা আসলেই এখানে দেখাবে' : 'The current list will appear once it arrives from the cloud'}</p>
            </div>
            {gatedQueuedList}
            </>
          ) : staffListStale ? (
            <>
            <ServerUnavailablePanel dataNameBn="স্টাফ তথ্য" dataNameEn="Staff data" />
            {gatedQueuedList}
            </>
          ) : (
          <div className="space-y-4">
            {/* Pending list update failure (Phase 1): never silently
                show a stale cache — the banner shows even when the
                list itself looks empty, with a retry. */}
            {pendingMembersError && (
              <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-2xl p-3.5 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">{pendingMembersError}</span>
                <button
                  type="button"
                  onClick={() => refreshPendingMembers()}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  {isBn ? 'আবার চেষ্টা করুন' : 'Retry'}
                </button>
              </div>
            )}

            {/* Pending Approvals Notice for Staff */}
            {pendingStaffApprovals.length > 0 && (
              <div className="bg-amber-500/10 border-2 border-amber-300 dark:border-amber-700 rounded-3xl p-5 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold">
                      <Clock size={20} className="animate-spin" style={{ animationDuration: '4s' }} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <span>অনুমোদনের অপেক্ষায় থাকা শিক্ষক ও কর্মী ({pendingStaffApprovals.length} জন)</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">অনুমোদন প্রয়োজন</span>
                      </h4>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {pendingStaffApprovals.map(staff => (
                    <div key={staff.id} className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{staff.nameBn || staff.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{staff.email || staff.phone || 'N/A'}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                          {staff.designation || 'সহকারী শিক্ষক'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleQuickApproveStaff(staff)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 size={13} />
                        <span>✓ অনুমোদন করুন</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setApplicantToReject(staff)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800 text-xs font-bold transition-all cursor-pointer"
                      >
                        <span>{isBn ? 'বাতিল' : 'Reject'}</span>
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter and Search Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3.5 top-2.5 text-slate-400 dark:text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder={isBn ? 'নাম, পদবি, ফোন বা আইডি দিয়ে খুঁজুন...' : 'Search staff by name, designation, phone...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="ALL">{isBn ? 'সকল ভূমিকা (All Roles)' : 'All Roles'}</option>
                  <option value="teacher">{isBn ? 'শিক্ষক' : 'Teacher'}</option>
                  <option value="accountant">{isBn ? 'হিসাবরক্ষক' : 'Accountant'}</option>
                  <option value="staff">{isBn ? 'অফিস স্টাফ' : 'Office Staff'}</option>
                  <option value="principal">{isBn ? 'অধ্যক্ষ' : 'Principal'}</option>
                  <option value="guardian">{isBn ? 'অভিভাবক' : 'Guardian'}</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="ALL">{isBn ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
                  <option value="ACTIVE">{isBn ? 'সক্রিয় (Active)' : 'Active'}</option>
                  <option value="PENDING">{isBn ? 'অপেক্ষমাণ (Pending)' : 'Pending'}</option>
                  <option value="INACTIVE">{isBn ? 'নিষ্ক্রিয় / সাবেক' : 'Inactive'}</option>
                </select>

                {/* Phase 4: table is a toggle, not a tab. */}
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDirectoryView('cards')}
                    className={`px-3 py-2 text-xs font-bold cursor-pointer ${directoryView === 'cards' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}
                  >
                    {isBn ? 'কার্ড' : 'Cards'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectoryView('table')}
                    className={`px-3 py-2 text-xs font-bold cursor-pointer ${directoryView === 'table' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}
                  >
                    {isBn ? 'টেবিল' : 'Table'}
                  </button>
                </div>

                {isAdminTier && demoUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDemoClearConfirm(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 transition-all cursor-pointer"
                  >
                    {isBn ? `ডেমো অ্যাকাউন্ট মুছুন (${demoUsers.length})` : `Clear demo accounts (${demoUsers.length})`}
                  </button>
                )}

                {canCreateStaff && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>{isBn ? '+ নতুন শিক্ষক যুক্ত' : 'Add Staff'}</span>
                </button>
                )}
              </div>
            </div>

            {/* Phase 4: demo-clear confirm (moved from Tab 2). */}
            <ConfirmDialog
              isOpen={showDemoClearConfirm}
              onClose={() => setShowDemoClearConfirm(false)}
              onConfirm={executeClearDemoUsers}
              title={isBn ? 'ডেমো অ্যাকাউন্ট মুছবেন?' : 'Clear demo accounts?'}
              message={isBn
                ? `শুধু ডেমো অ্যাকাউন্ট (${demoUsers.length}টি) মুছে যাবে — আসল শিক্ষক/কর্মী, সুপার অ্যাডমিন ও আপনার নিজের অ্যাকাউন্ট থাকবে। এই কাজ ফেরানো যাবে না।`
                : `Only demo accounts (${demoUsers.length}) will be removed — real staff, super admin and your own account stay. This cannot be undone.`}
              confirmLabel={isBn ? 'হ্যাঁ, মুছুন' : 'Yes, clear'}
              cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
              variant="danger"
              isLoading={isClearingDemo}
            />

            {/* Phase 2: reject-application confirmation (trash note). */}
            <ConfirmDialog
              isOpen={!!applicantToReject}
              onClose={() => setApplicantToReject(null)}
              onConfirm={handleConfirmRejectApplicant}
              title={isBn ? 'আবেদন বাতিল করবেন?' : 'Reject this application?'}
              message={isBn
                ? 'আবেদনটি বাতিল হলে রিসাইকেল বিনে সংরক্ষিত থাকবে — তথ্য হারাবে না। আবেদনকারীর কোনো অ্যাক্সেস থাকবে না।'
                : 'The rejected application will be kept in the Recycle Bin — no data is lost. The applicant will have no access.'}
              highlightText={applicantToReject ? (applicantToReject.nameBn || applicantToReject.name) : undefined}
              confirmLabel={isBn ? 'হ্যাঁ, বাতিল করুন' : 'Yes, reject'}
              cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
              variant="danger"
            />

            {/* Staff Grid Cards (Phase 4: cards are the main view;
                the table below is a toggle, not a tab). */}
            {directoryView === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((staff, idx) => (
                <div 
                  key={staff.id || idx} 
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 hover:border-teal-300 transition-all space-y-4 relative group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg">
                        {(staff.nameBn || staff.name || 'উ')[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                          {isBn ? (staff.nameBn || staff.name) : staff.name}
                        </h4>
                        {/* Phase 1 (Sadia fix): a record whose cloud
                            confirm failed stays visibly marked until
                            its queued payload lands. */}
                        {(isRecordUnconfirmed('teachers', staff.id) || isRecordUnconfirmed('users', staff.id)) && (
                          <UnconfirmedBadge isBn={isBn} />
                        )}
                        {Boolean(staff.status?.toUpperCase() === 'PENDING' || pendingMembers.some(m => m.uid === staff.id || (staff.email && m.email?.toLowerCase() === staff.email.toLowerCase()))) ? (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              {isBn ? 'অপেক্ষমাণ (Pending)' : 'Pending'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuickApproveStaff(staff)}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 size={11} />
                              <span>{isBn ? '✓ অনুমোদন' : 'Approve'}</span>
                            </button>
                          </div>
                        ) : (
                          <>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200/80">
                            {staff.designation || 'সহকারী শিক্ষক'}
                          </span>
                          {(staff.status || '').toUpperCase() === 'INACTIVE' && (
                            <span className="inline-block mt-0.5 ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                              {isBn ? 'নিষ্ক্রিয়' : 'Inactive'}
                            </span>
                          )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(staff)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                        title={isBn ? 'সম্পাদনা করুন' : 'Edit'}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setStaffToDelete(staff)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        title={isBn ? 'স্থায়ীভাবে মুছে ফেলুন' : 'Remove permanently'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Phase 4 merged-card role row: primary role +
                      additional chips from the linked account (never
                      from designation text); legacy unmapped
                      designations carry a verify mark for hand-fix. */}
                  {(() => {
                    const r = resolveStaffRole(staff, users);
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{isBn ? 'ভূমিকা:' : 'Role:'}</span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {roleLabelBn(r.role)}
                        </span>
                        {r.additionalRoles.map(ar => (
                          <span key={ar} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            + {roleLabelBn(ar)}
                          </span>
                        ))}
                        {r.needsRoleVerify && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700" title={isBn ? 'এই পদবি তালিকায় নেই — রোল যাচাই করে ঠিক করুন' : 'Unmapped designation — verify the role by hand'}>
                            {isBn ? 'রোল যাচাই করুন' : 'Verify role'}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Info details */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">{isBn ? 'আইডি / কোড:' : 'Employee ID:'}</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{staff.employeeCode || `EMP-${staff.id.slice(0, 6)}`}</span>
                    </div>

                    {staff.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">{isBn ? 'মোবাইল নম্বর:' : 'Phone:'}</span>
                        <a href={`tel:${staff.phone}`} className="font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1">
                          <Phone size={11} />
                          <span>{staff.phone}</span>
                        </a>
                      </div>
                    )}

                    {staff.email && (
                      <div className="flex items-center justify-between truncate">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">{isBn ? 'ইমেইল:' : 'Email:'}</span>
                        <span className="text-slate-600 dark:text-slate-300 text-[11px] truncate">{staff.email}</span>
                      </div>
                    )}

                    {staff.password && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">{isBn ? 'লগইন পাসওয়ার্ড:' : 'Login Password:'}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">{revealedPwId === staff.id ? staff.password : '••••••'}</span>
                          <button
                            type="button"
                            onClick={() => setRevealedPwId(revealedPwId === staff.id ? null : staff.id)}
                            className="text-slate-400 dark:text-slate-500 hover:text-teal-700 transition-colors"
                            title={isBn ? 'দেখুন/লুকান' : 'Show/hide'}
                          >
                            {revealedPwId === staff.id ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Assigned Classes / Subjects Tags */}
                  {staff.assignedClasses && staff.assignedClasses.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                        {isBn ? 'দায়িত্বপ্রাপ্ত শ্রেণি:' : 'Assigned Classes:'}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {staff.assignedClasses.map((cls, cIdx) => (
                          <span key={cIdx} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {staff.assignedSubjects && staff.assignedSubjects.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                        {isBn ? 'দায়িত্বপ্রাপ্ত বিষয়:' : 'Assigned Subjects:'}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {staff.assignedSubjects.map((sub, sIdx) => (
                          <span key={sIdx} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTeacherForIdCard(staff);
                        setActiveTab('id_cards');
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1"
                    >
                      <Award size={12} className="text-teal-600 dark:text-teal-400" />
                      <span>{isBn ? 'আইডি কার্ড' : 'ID Card'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCertificateTeacher(staff);
                        setIsCertificateModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 text-teal-800 dark:text-teal-300 transition-colors flex items-center gap-1"
                    >
                      <FileText size={12} />
                      <span>{isBn ? 'প্রত্যয়নপত্র' : 'NOC'}</span>
                    </button>

                    {staff.phone && (
                      <a
                        href={`https://wa.me/${staff.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 transition-colors"
                        title="WhatsApp"
                      >
                        <Send size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {filteredStaff.length === 0 && (
                <div className="col-span-full bg-white dark:bg-slate-900 p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <Users size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                    {isBn ? 'কোনো শিক্ষক বা কর্মচারীর তথ্য পাওয়া যায়নি' : 'No staff records found'}
                  </p>
                </div>
              )}
            </div>
            )}

            {/* Phase 4: table view — a toggle over the same merged
                list, not a tab. Same actions as the cards. */}
            {directoryView === 'table' && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-xs min-w-[720px]">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-3 py-2.5 font-bold">{isBn ? 'নাম' : 'Name'}</th>
                      <th className="px-3 py-2.5 font-bold">{isBn ? 'পদবি' : 'Designation'}</th>
                      <th className="px-3 py-2.5 font-bold">{isBn ? 'ভূমিকা' : 'Role'}</th>
                      <th className="px-3 py-2.5 font-bold">{isBn ? 'লগইন আইডি' : 'Login ID'}</th>
                      <th className="px-3 py-2.5 font-bold">{isBn ? 'শ্রেণি' : 'Classes'}</th>
                      <th className="px-3 py-2.5 font-bold">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                      <th className="px-3 py-2.5 font-bold">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((staff, idx) => {
                      const isPendingCard = (staff.status || '').toUpperCase() === 'PENDING' ||
                        pendingMembers.some(m => m.uid === staff.id || (staff.email && m.email?.toLowerCase() === staff.email.toLowerCase()));
                      const r = resolveStaffRole(staff, users);
                      return (
                        <tr key={staff.id || idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{isBn ? (staff.nameBn || staff.name) : staff.name}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{staff.designation || 'সহকারী শিক্ষক'}</td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300">{roleLabelBn(r.role)}</span>
                            {r.additionalRoles.map(ar => (
                              <span key={ar} className="ml-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">+ {roleLabelBn(ar)}</span>
                            ))}
                            {r.needsRoleVerify && (
                              <span className="ml-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">{isBn ? 'রোল যাচাই করুন' : 'Verify role'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{staff.email || staff.phone || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{(staff.assignedClasses || []).join(', ') || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isPendingCard ? 'bg-amber-100 text-amber-800' : (staff.status || '').toUpperCase() === 'INACTIVE' ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-800'}`}>
                              {isPendingCard ? (isBn ? 'অপেক্ষমাণ' : 'Pending') : (staff.status || 'ACTIVE')}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              {isPendingCard ? (
                                <>
                                  <button type="button" onClick={() => handleQuickApproveStaff(staff)} className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">{isBn ? '✓ অনুমোদন' : 'Approve'}</button>
                                  <button type="button" onClick={() => setApplicantToReject(staff)} className="px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-rose-300 text-rose-700 cursor-pointer">{isBn ? 'বাতিল' : 'Reject'}</button>
                                </>
                              ) : (
                                <>
                                  <button type="button" onClick={() => handleOpenEditModal(staff)} className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50" title={isBn ? 'সম্পাদনা' : 'Edit'}><Edit2 size={13} /></button>
                                  <button type="button" onClick={() => setStaffToDelete(staff)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50" title={isBn ? 'মুছুন' : 'Delete'}><Trash2 size={13} /></button>
                                  <button type="button" onClick={() => { setSelectedTeacherForIdCard(staff); setActiveTab('id_cards'); }} className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700" title={isBn ? 'আইডি কার্ড' : 'ID Card'}><Award size={12} /></button>
                                  <button type="button" onClick={() => { setCertificateTeacher(staff); setIsCertificateModalOpen(true); }} className="px-2 py-1 rounded-md text-[10px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-800" title={isBn ? 'প্রত্যয়নপত্র' : 'NOC'}><FileText size={12} /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredStaff.length === 0 && (
                  <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                      {isBn ? 'কোনো শিক্ষক বা কর্মচারীর তথ্য পাওয়া যায়নি' : 'No staff records found'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          )
        )}

        {/* 2. Workload & Subject Assignment */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <SubjectManager initialTab="teacher_assignment" />
          </div>
        )}

        {/* Merged tab inner switch: হাজিরা / ছুটি (ছুটি is admin-only, as before). */}
        {activeTab === 'attendance' && isAdminTier && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setAttendanceSection('attendance')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                attendanceSection === 'attendance'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <CalendarCheck size={15} />
              <span>{isBn ? 'দৈনিক হাজিরা' : 'Daily Attendance'}</span>
            </button>
            <button
              type="button"
              onClick={() => setAttendanceSection('leaves')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                attendanceSection === 'leaves'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Clock size={15} />
              <span>{isBn ? 'ছুটি ও আবেদন' : 'Leave Records'}</span>
              {kpis.leavesTodayCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  attendanceSection === 'leaves' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}>
                  {kpis.leavesTodayCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* 4. Staff Daily Attendance (merged tab, হাজিরা section) */}
        {activeTab === 'attendance' && attendanceSection === 'attendance' && (
          <div className="space-y-4">
            <DailyAttendanceHub initialMode="staff" onNavigateTab={onNavigateTab} />
          </div>
        )}

        {/* 5. Payroll & Salary */}
        {activeTab === 'payroll' && (
          <div className="space-y-5">
            <TeacherSalaryEntry
              transactions={transactions}
              language={language as 'en' | 'bn'}
              onAddTransaction={(tx) => addTransaction(tx)}
              // Phase 5: salary saves confirm the transactions field
              // before any success toast or receipt (same field the
              // fee confirm writes; the failure text is salary-specific).
              onConfirmTransactions={(next) => confirmFeeCloudSync(next, SALARY_CLOUD_FAILURE_MESSAGE)}
              onShowReceipt={(tx) => setSalaryReceiptTx(tx)}
              showToast={showToast}
            />

            {/* Salary Receipt Modal */}
            {salaryReceiptTx && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                      <CreditCard size={16} className="text-teal-600 dark:text-teal-400" />
                      <span>{isBn ? 'বেতন পরিশোধ রসিদ (Pay Slip)' : 'Salary Payment Receipt'}</span>
                    </h3>
                    <button 
                      onClick={() => setSalaryReceiptTx(null)}
                      className="text-slate-400 dark:text-slate-500 hover:text-slate-600 p-1"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2 font-medium">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{isBn ? 'ভাউচার নম্বর:' : 'Voucher No:'}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{salaryReceiptTx.voucherNo || salaryReceiptTx.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{isBn ? 'শিক্ষক/কর্মী:' : 'Staff Name:'}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{salaryReceiptTx.staffName || salaryReceiptTx.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{isBn ? 'পরিশোধের তারিখ:' : 'Date:'}</span>
                      <span className="text-slate-800 dark:text-slate-100">{salaryReceiptTx.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{isBn ? 'পরিশোধ মাধ্যম:' : 'Payment Method:'}</span>
                      <span className="font-bold text-teal-800 dark:text-teal-300">{salaryReceiptTx.paymentMethod || 'CASH'}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-sm font-black text-slate-900 dark:text-white">
                      <span>{isBn ? 'মোট পরিশোধিত বেতন:' : 'Total Disbursed:'}</span>
                      <span className="text-emerald-700 dark:text-emerald-400">৳ {formatBanglaNumber(salaryReceiptTx.amount)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5"
                    >
                      <Printer size={14} />
                      <span>{isBn ? 'রসিদ প্রিন্ট করুন' : 'Print Receipt'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. Leave Records (merged tab, ছুটি section — admin-only) */}
        {activeTab === 'attendance' && attendanceSection === 'leaves' && isAdminTier && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Clock size={18} className="text-teal-600 dark:text-teal-400" />
                  <span>{isBn ? 'শিক্ষক ও কর্মচারী ছুটি রেজিস্টার' : 'Staff Leave & Absence Ledger'}</span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Clock size={14} />
                <span>{isBn ? '+ ছুটির আবেদন যোগ করুন' : 'Record Leave'}</span>
              </button>
            </div>

            {/* Leave Records Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">{isBn ? 'শিক্ষক/কর্মী' : 'Staff'}</th>
                      <th className="py-3 px-4">{isBn ? 'ছুটির ধরন' : 'Leave Type'}</th>
                      <th className="py-3 px-4">{isBn ? 'সময়কাল' : 'Duration'}</th>
                      <th className="py-3 px-4 text-center">{isBn ? 'মোট দিন' : 'Days'}</th>
                      <th className="py-3 px-4">{isBn ? 'ছুটির কারণ' : 'Reason'}</th>
                      <th className="py-3 px-4 text-center">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                      <th className="py-3 px-4 text-right">{isBn ? 'অনুমোদনকারী' : 'Approved By'}</th>
                      <th className="py-3 px-4 text-right">{isBn ? 'অ্যাকশন' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {leaves.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{l.teacherName}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">{l.designation}</div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200">
                          {l.leaveType === 'CASUAL' ? (isBn ? 'নৈমিত্তিক ছুটি' : 'Casual Leave') :
                           l.leaveType === 'SICK' ? (isBn ? 'অসুস্থতাজনিত ছুটি' : 'Sick Leave') :
                           l.leaveType === 'HAJJ_UMRAH' ? (isBn ? 'হজ্ব/ওমরাহ ছুটি' : 'Hajj/Umrah') :
                           l.leaveType === 'MATERNITY' ? (isBn ? 'মাতৃত্বকালীন ছুটি' : 'Maternity Leave') :
                           (isBn ? 'বিশেষ ছুটি' : 'Special Leave')}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                          {l.startDate} {l.startDate !== l.endDate ? `থেকে ${l.endDate}` : ''}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-100">
                          {formatNumber(l.daysCount, 'bn')} দিন
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          {l.reason || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.status === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300' :
                            l.status === 'PENDING' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300' :
                            'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'
                          }`}>
                            {l.status === 'APPROVED' ? (isBn ? 'অনুমোদিত' : 'Approved') :
                             l.status === 'PENDING' ? (isBn ? 'অপেক্ষমাণ' : 'Pending') :
                             (isBn ? 'বাতিল' : 'Rejected')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-300 font-medium">
                          {l.approvedBy || (isBn ? 'অধ্যক্ষ' : 'Principal')}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {l.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleLeaveDecision(l.id, 'APPROVED')}
                                className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                title={isBn ? 'অনুমোদন করুন' : 'Approve'}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLeaveDecision(l.id, 'REJECTED')}
                                className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                title={isBn ? 'বাতিল করুন' : 'Reject'}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteLeave(l.id)}
                            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title={isBn ? 'রেকর্ড মুছুন' : 'Delete record'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 7. Staff ID Cards & Certificates */}
        {activeTab === 'id_cards' && (
          <div className="space-y-5">
            {/* Control Bar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Award size={18} className="text-teal-600" />
                  <span>{isBn ? 'শিক্ষক ও কর্মচারী ডিজিটাল আইডি কার্ড' : 'Faculty & Staff Identity Cards'}</span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={15} />
                <span>{isBn ? 'আইডি কার্ড প্রিন্ট করুন' : 'Print Cards'}</span>
              </button>
            </div>

            {/* ID Cards Showcase Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStaff.map((staff, idx) => (
                <div 
                  key={staff.id || idx}
                  className="bg-white border-2 border-teal-600/30 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between max-w-sm mx-auto w-full aspect-[54/86] transition-all"
                  style={{ minHeight: '380px' }}
                >
                  {/* Top Madrasah Branding Header */}
                  <div className="text-center border-b border-teal-100 pb-3">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-sm mb-1.5">
                      {schoolProfile.nameBn ? schoolProfile.nameBn[0] : 'ম'}
                    </div>
                    <h3 className="font-black text-slate-900 text-sm leading-tight">
                      {schoolProfile.nameBn || schoolProfile.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {schoolProfile.addressBn || schoolProfile.address || 'বাংলাদেশ'}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-800 text-white">
                      {isBn ? 'শিক্ষক ও কর্মচারী পরিচয়পত্র' : 'Staff Identity Card'}
                    </span>
                  </div>

                  {/* Photo & Profile */}
                  <div className="text-center my-auto py-2">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-slate-200 border-2 border-teal-600/40 flex items-center justify-center font-black text-2xl text-teal-800">
                      {(staff.nameBn || staff.name || 'উ')[0]}
                    </div>
                    <h4 className="font-black text-base text-slate-900 mt-2.5">
                      {isBn ? (staff.nameBn || staff.name) : staff.name}
                    </h4>
                    <p className="text-xs font-bold text-teal-700">
                      {staff.designation || 'সহকারী শিক্ষক'}
                    </p>
                    <div className="font-mono text-[11px] font-bold text-slate-500 mt-0.5">
                      ID: {staff.employeeCode || `MDR-T${idx + 1}`}
                    </div>
                  </div>

                  {/* Bottom Footer Info */}
                  <div className="border-t border-teal-100 pt-3 text-[10px] text-slate-600 flex items-end justify-between">
                    <div>
                      <div><strong className="text-slate-800">{isBn ? 'মোবাইল:' : 'Phone:'}</strong> {staff.phone || 'N/A'}</div>
                      <div><strong className="text-slate-800">{isBn ? 'মেয়াদ:' : 'Valid:'}</strong> {schoolProfile.academicYear || '২০২৫-২০২৬'}</div>
                    </div>

                    <div className="text-center">
                      <div className="w-12 h-6 border-b border-slate-400 mx-auto mb-0.5"></div>
                      <span className="text-[9px] font-bold text-slate-500">{isBn ? 'অধ্যক্ষ স্বাক্ষর' : 'Principal'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. HR Analytics & Census */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{isBn ? 'জনবল কাঠামো বিভাজন' : 'Staff Breakdown'}</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'শিক্ষক ও মুয়াল্লিম:' : 'Teachers:'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatNumber(kpis.teachersOnlyCount, 'bn')} জন</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'মোট কর্মী:' : 'Total Staff:'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatNumber(kpis.totalStaffCount, 'bn')} জন</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'প্রশাসনিক ও অফিস স্টাফ:' : 'Administrative Staff:'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatNumber(kpis.officeStaffCount, 'bn')} জন</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{isBn ? 'মাসিক বেতন পরিসংখ্যান' : 'Monthly Salary Census'}</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'চলতি মাসে প্রদেয়:' : 'Disbursed:'}</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">৳ {formatBanglaNumber(kpis.totalDisbursed)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'গড় মাসিক শিক্ষক বেতন:' : 'Average Salary:'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{kpis.paidStaffCount > 0 ? `৳ ${formatBanglaNumber(kpis.avgSalary)}` : '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'এই মাসে বেতন পেয়েছেন:' : 'Paid This Month:'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatNumber(kpis.paidStaffCount, 'bn')} জন</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{isBn ? 'হাজিরা ও কর্মদিবস সারসংক্ষেপ' : 'Attendance Summary'}</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'গড় স্টাফ উপস্থিতি হার:' : 'Avg Attendance Rate:'}</span>
                    <span className="font-bold text-teal-700 dark:text-teal-400">{kpis.attendanceRecorded ? `${kpis.staffAttendanceRate}%` : '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'অনুমোদিত মোট ছুটি (মাসিক):' : 'Total Leaves This Month:'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatNumber(kpis.monthlyApprovedLeavesCount, 'bn')} টি</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'আজ উপস্থিত কর্মী:' : 'Present Today:'}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{kpis.attendanceRecorded ? `${formatNumber(kpis.presentToday, 'bn')} জন` : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approval Dialog (Phase 1): class/subject picks are mandatory
          context for a teacher approval — the old 1-click approve sent
          empty arrays. Scroll-safe: outer scrolls, panel scrolls
          internally, footer sticks to the panel bottom. */}
      {approvingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                {isBn ? 'অনুমোদন করুন' : 'Approve'}: {approvingStaff.nameBn || approvingStaff.name}
              </h3>
              <button
                type="button"
                onClick={() => setApprovingStaff(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div>{isBn ? 'পদবি: ' : 'Designation: '}<span className="font-bold text-slate-900 dark:text-white">{approvingStaff.designation || 'সহকারী শিক্ষক'}</span></div>
                <div>{isBn ? 'ভূমিকা (role): ' : 'Role: '}<span className="font-bold text-slate-900 dark:text-white">{(() => { const r = resolveApprovalRoleId(approvingStaff, users); return r === 'role_teacher' ? 'শিক্ষক' : r === 'role_accountant' ? 'হিসাবরক্ষক' : r === 'role_principal' ? 'অধ্যক্ষ' : r === 'role_guardian' ? 'অভিভাবক' : r === 'role_office_staff' ? 'অফিস স্টাফ' : 'স্টাফ'; })()}</span></div>
                <p className="text-slate-500 dark:text-slate-400">{isBn ? 'শ্রেণি ও বিষয় বেছে দিন — খালি রাখলে অনুমোদিত শিক্ষকের কোনো ক্লাস থাকবে না।' : 'Pick classes and subjects — leaving them empty approves the teacher with no classes.'}</p>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5 text-xs">
                  {isBn ? 'দায়িত্বপ্রাপ্ত শ্রেণি:' : 'Assigned Classes:'}
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl max-h-28 overflow-y-auto">
                  {classes.map(c => {
                    const isSelected = approveClasses.includes(c.name);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setApproveClasses(isSelected ? approveClasses.filter(cn => cn !== c.name) : [...approveClasses, c.name])}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected ? 'bg-teal-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'}`}
                      >
                        {isSelected ? '✓ ' : ''}{c.nameBn || c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5 text-xs">
                  {isBn ? 'বিষয়:' : 'Subjects:'}
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl max-h-28 overflow-y-auto">
                  {subjects.map(s => {
                    const isSelected = approveSubjects.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setApproveSubjects(isSelected ? approveSubjects.filter(sn => sn !== s.name) : [...approveSubjects, s.name])}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected ? 'bg-teal-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'}`}
                      >
                        {isSelected ? '✓ ' : ''}{s.nameBn || s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setApprovingStaff(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold text-xs cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isApproving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
              >
                {isApproving ? (isBn ? 'অনুমোদন হচ্ছে...' : 'Approving...') : (isBn ? '✓ অনুমোদন করুন' : 'Approve')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                <UserPlus size={18} className="text-teal-600 dark:text-teal-400" />
                <span>{editingTeacher ? (isBn ? 'শিক্ষক/কর্মী তথ্য সম্পাদনা' : 'Edit Staff') : (isBn ? 'নতুন শিক্ষক/কর্মচারী নিবন্ধন' : 'Add New Staff')}</span>
              </h3>
              <button 
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTeacher} className="flex-1 overflow-y-auto p-5 space-y-3 text-xs custom-scrollbar">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'পূর্ণ নাম (বাংলা):' : 'Full Name (Bangla):'} *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মাওলানা মাহমুদ হাসান"
                  value={teacherFormData.nameBn || ''}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, nameBn: e.target.value, name: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'পদবি (Designation):' : 'Designation:'}</label>
                  {/* Phase 3: fixed list — free text alone never decides
                      a role. A mapped pick also sets the Login Role;
                      "other" keeps the custom title but the role still
                      comes from the explicit Login Role select below. */}
                  <select
                    value={formDesignationSelect}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormDesignationSelect(v);
                      setFormErrors(prev => ({ ...prev, designation: undefined }));
                      if (v === DESIGNATION_OTHER) {
                        setTeacherFormData(prev => ({ ...prev, designation: '' }));
                      } else {
                        const opt = DESIGNATION_OPTIONS.find(o => o.value === v);
                        setTeacherFormData(prev => ({ ...prev, designation: v }));
                        if (opt) setFormLoginRole(opt.role);
                      }
                    }}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white dark:bg-slate-900"
                  >
                    {DESIGNATION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.labelBn}</option>
                    ))}
                    {/* Stored title not in the fixed list (e.g. প্রধান শিক্ষক):
                        show it as-is instead of displaying the first option. */}
                    {!DESIGNATION_OPTIONS.some(o => o.value === formDesignationSelect) && formDesignationSelect !== DESIGNATION_OTHER && (
                      <option value={formDesignationSelect}>{formDesignationSelect}</option>
                    )}
                    <option value={DESIGNATION_OTHER}>{isBn ? 'অন্যান্য (নিজে লিখুন)' : 'Other (type below)'}</option>
                  </select>
                  {formDesignationSelect === DESIGNATION_OTHER && (
                    <input
                      type="text"
                      placeholder="যেমন: আরবি প্রভাষক"
                      value={teacherFormData.designation || ''}
                      onChange={(e) => { setTeacherFormData({ ...teacherFormData, designation: e.target.value }); if (formErrors.designation) setFormErrors(prev => ({ ...prev, designation: undefined })); }}
                      className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none mt-2"
                    />
                  )}
                  {formErrors.designation && <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.designation}</p>}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'আইডি / কোড:' : 'Employee Code:'}</label>
                  <input
                    ref={employeeCodeInputRef}
                    type="text"
                    placeholder="MDR-T001"
                    value={teacherFormData.employeeCode || ''}
                    onChange={(e) => { setTeacherFormData({ ...teacherFormData, employeeCode: e.target.value }); if (formErrors.employeeCode) setFormErrors(prev => ({ ...prev, employeeCode: undefined })); }}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  {formErrors.employeeCode && <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.employeeCode}</p>}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'লগইন রোল (Login Role):' : 'Login Role:'}</label>
                <select
                  value={formLoginRole}
                  onChange={(e) => setFormLoginRole(e.target.value as UserRole)}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white dark:bg-slate-900"
                >
                  <option value="teacher">{isBn ? 'শিক্ষক (Teacher)' : 'Teacher'}</option>
                  <option value="accountant">{isBn ? 'হিসাবরক্ষক / ক্যাশিয়ার (Accountant)' : 'Accountant / Cashier'}</option>
                  <option value="staff">{isBn ? 'অফিস স্টাফ (Office Staff)' : 'Office Staff'}</option>
                  <option value="principal">{isBn ? 'অধ্যক্ষ (Principal)' : 'Principal'}</option>
                  <option value="guardian">{isBn ? 'অভিভাবক (Guardian)' : 'Guardian'}</option>
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{isBn ? 'উনি এই রোলেই লগইন করে নিজের পোর্টাল দেখবেন। তালিকা থেকে পদবি বাছলে রোল নিজে থেকে মিলে যায়; অন্যান্য পদবির ক্ষেত্রে এই রোলই চূড়ান্ত।' : 'They will log in with this role and see that portal. Picking a listed designation sets this role; for a custom title, this pick is final.'}</p>
              </div>

              {/* Additional roles (multi-role): one person can hold two
                  roles at once — e.g. principal + teacher, accountant +
                  teacher. Access is the union of all their roles. */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'অতিরিক্ত রোল (যদি থাকে):' : 'Additional Role(s), if any:'}</label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { key: 'teacher', bn: 'শিক্ষক (Teacher)', en: 'Teacher' },
                    { key: 'accountant', bn: 'হিসাবরক্ষক / ক্যাশিয়ার (Accountant)', en: 'Accountant / Cashier' },
                    { key: 'staff', bn: 'অফিস স্টাফ (Office Staff)', en: 'Office Staff' },
                    { key: 'principal', bn: 'অধ্যক্ষ (Principal)', en: 'Principal' },
                    { key: 'guardian', bn: 'অভিভাবক (Guardian)', en: 'Guardian' }
                  ] as { key: UserRole; bn: string; en: string }[])
                    .filter(opt => opt.key !== formLoginRole)
                    .map(opt => {
                      const isSelected = formAdditionalRoles.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setFormAdditionalRoles(prev =>
                            isSelected ? prev.filter(r => r !== opt.key) : [...prev, opt.key]
                          )}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-teal-600 text-white'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{isBn ? opt.bn : opt.en}
                        </button>
                      );
                    })}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{isBn ? 'একজন একসাথে দুটি দায়িত্ব পালন করলে (যেমন হিসাবরক্ষক + শিক্ষক) অতিরিক্ত রোলটি টিক দিন — তিনি সব রোলের অ্যাক্সেসই পাবেন।' : 'If one person holds two duties at once (e.g. accountant + teacher), tick the extra role — they get the access of every role they hold.'}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'স্ট্যাটাস (Status):' : 'Status:'}</label>
                <select
                  value={teacherFormData.status || 'ACTIVE'}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, status: e.target.value as AcademicTeacher['status'] })}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white dark:bg-slate-900"
                >
                  <option value="ACTIVE">{isBn ? 'সক্রিয় (Active)' : 'Active'}</option>
                  <option value="INACTIVE">{isBn ? 'নিষ্ক্রিয় / সাবেক (Inactive)' : 'Inactive'}</option>
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{isBn ? 'নিষ্ক্রিয় করলে উনি তালিকায় থাকবেন কিন্তু সাবেক হিসেবে চিহ্নিত হবেন। পুরোপুরি সরাতে কার্ডের মুছে-ফেলুন বাটন ব্যবহার করুন।' : 'Inactive keeps the record, marked as former. Use the card delete button to remove permanently.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'মোবাইল নম্বর:' : 'Phone:'}</label>
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    placeholder="017xxxxxxxx"
                    value={teacherFormData.phone || ''}
                    onChange={(e) => { setTeacherFormData({ ...teacherFormData, phone: e.target.value }); if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: undefined })); }}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  {formErrors.phone && <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.phone}</p>}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'ইমেইল:' : 'Email:'}</label>
                  <input
                    ref={emailInputRef}
                    type="email"
                    placeholder="teacher@madrasha.edu.bd"
                    value={teacherFormData.email || ''}
                    onChange={(e) => { setTeacherFormData({ ...teacherFormData, email: e.target.value }); if (formErrors.email) setFormErrors(prev => ({ ...prev, email: undefined })); }}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  {formErrors.email && <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.email}</p>}
                </div>
              </div>

              {/* Login Password */}
              <div className="bg-teal-50/70 p-3 rounded-2xl border border-teal-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-teal-950 dark:text-teal-200 text-xs">
                    {isBn ? 'লগইন পাসওয়ার্ড (Login Password):' : 'Login Password:'}{editingTeacher ? '' : ' *'}
                  </label>
                  <span className="text-[10px] text-teal-700 dark:text-teal-400 bg-teal-100/70 px-2 py-0.5 rounded-full font-bold">
                    {isBn ? 'সরাসরি লগইনের জন্য' : 'For direct login'}
                  </span>
                </div>
                <input
                  ref={passwordInputRef}
                  type="text"
                  required={!editingTeacher}
                  placeholder={editingTeacher ? (isBn ? 'ফাঁকা রাখলে আগের পাসওয়ার্ড থাকবে' : 'Leave blank to keep the old password') : (isBn ? 'পাসওয়ার্ড দিন' : 'Enter a password')}
                  value={teacherFormData.password || ''}
                  onChange={(e) => { setTeacherFormData({ ...teacherFormData, password: e.target.value }); if (formErrors.password) setFormErrors(prev => ({ ...prev, password: undefined })); }}
                  className="w-full border border-teal-200 dark:border-teal-800 rounded-xl p-2.5 font-mono text-sm font-bold bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                {formErrors.password && <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.password}</p>}

              </div>

              {/* Assigned Classes */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  {isBn ? 'দায়িত্বপ্রাপ্ত শ্রেণি (Assigned Classes - শ্রেণি শিক্ষক):' : 'Assigned Class(es):'}
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl max-h-28 overflow-y-auto">
                  {classes.map(c => {
                    const isSelected = (teacherFormData.assignedClasses || []).includes(c.name);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const current = teacherFormData.assignedClasses || [];
                          const updated = isSelected 
                            ? current.filter(cn => cn !== c.name)
                            : [...current, c.name];
                          setTeacherFormData({ ...teacherFormData, assignedClasses: updated });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-teal-600 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? '✓ ' : ''}{c.nameBn || c.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {isBn ? 'শ্রেণি শিক্ষক হিসেবে নির্বাচিত শ্রেণির শিক্ষার্থী ও বকেয়া ফি এই শিক্ষক দেখতে পাবেন।' : 'Teacher will see students and dues for selected classes.'}
                </p>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-slate-900 flex justify-end gap-2 pt-3 pb-1 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Staff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Staff Confirm Modal */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">{isBn ? 'রিসাইকেল বিনে পাঠাবেন?' : 'Move to Recycle Bin?'}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'পরে রিসাইকেল বিন থেকে ফিরিয়ে আনা যাবে' : 'You can restore it later from the Recycle Bin'}</p>
              </div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/60 rounded-2xl p-3.5 text-xs text-slate-700 dark:text-slate-200 space-y-1">
              <p className="font-bold text-slate-900 dark:text-white text-sm">{staffToDelete.nameBn || staffToDelete.name}</p>
              <p>{staffToDelete.designation || (isBn ? 'সহকারী শিক্ষক' : 'Assistant Teacher')}{staffToDelete.phone ? ` · ${staffToDelete.phone}` : ''}</p>
              <p className="text-slate-500 dark:text-slate-400 pt-1">{isBn ? 'তার স্টাফ রেকর্ড ও লগইন অ্যাকাউন্ট রিসাইকেল বিনে চলে যাবে। পুরনো বেতন ও হাজিরার রেকর্ড আগের মতোই থাকবে।' : 'Their staff record and login account will move to the Recycle Bin. Past salary and attendance records stay untouched.'}</p>
              <p className="text-amber-700 dark:text-amber-300 font-bold pt-1">{isBn ? 'রিসাইকেল বিনে পাঠানোর পর এই অ্যাকাউন্ট দিয়ে আর লগইন করা যাবে না (অ্যাক্সেস সাথে সাথে বন্ধ হবে)। Firebase Authentication-এর রেকর্ডটি পুরোপুরি মুছতে চাইলে Console → Authentication থেকে মুছুন।' : 'After removal, this account can no longer log in (access stops immediately). To fully remove the Firebase Authentication record, delete it from Console → Authentication.'}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold text-xs cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={isDeletingStaff}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 text-xs disabled:opacity-60 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>{isDeletingStaff ? (isBn ? 'মোছা হচ্ছে...' : 'Removing...') : (isBn ? 'হ্যাঁ, বিনে পাঠান' : 'Yes, move to bin')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                <Clock size={18} className="text-teal-600 dark:text-teal-400" />
                <span>{isBn ? 'ছুটির আবেদন ও এন্ট্রি' : 'Record Staff Leave'}</span>
              </h3>
              <button onClick={() => setIsLeaveModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLeave} className="flex-1 overflow-y-auto p-5 space-y-3 text-xs custom-scrollbar">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'শিক্ষক/কর্মী নির্বাচন:' : 'Select Staff:'} *</label>
                <select
                  required
                  value={newLeaveData.teacherId}
                  onChange={(e) => setNewLeaveData({ ...newLeaveData, teacherId: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-white dark:bg-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="">{isBn ? '-- শিক্ষক নির্বাচন করুন --' : '-- Select Teacher --'}</option>
                  {unifiedStaffList.map(s => (
                    <option key={s.id} value={s.id}>{isBn ? (s.nameBn || s.name) : s.name} ({s.designation})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'ছুটির ধরন:' : 'Leave Type:'}</label>
                <select
                  value={newLeaveData.leaveType}
                  onChange={(e) => setNewLeaveData({ ...newLeaveData, leaveType: e.target.value as any })}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-white dark:bg-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="CASUAL">{isBn ? 'নৈমিত্তিক ছুটি (Casual Leave)' : 'Casual Leave'}</option>
                  <option value="SICK">{isBn ? 'অসুস্থতাজনিত ছুটি (Sick Leave)' : 'Sick Leave'}</option>
                  <option value="HAJJ_UMRAH">{isBn ? 'হজ্ব / ওমরাহ ছুটি' : 'Hajj/Umrah Leave'}</option>
                  <option value="MATERNITY">{isBn ? 'মাতৃত্বকালীন ছুটি' : 'Maternity Leave'}</option>
                  <option value="SPECIAL">{isBn ? 'বিশেষ ছুটি' : 'Special Leave'}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'শুরুর তারিখ:' : 'Start Date:'}</label>
                  <input
                    type="date"
                    required
                    value={newLeaveData.startDate}
                    onChange={(e) => setNewLeaveData({ ...newLeaveData, startDate: e.target.value })}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'শেষের তারিখ:' : 'End Date:'}</label>
                  <input
                    type="date"
                    required
                    value={newLeaveData.endDate}
                    onChange={(e) => setNewLeaveData({ ...newLeaveData, endDate: e.target.value })}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'ছুটির কারণ:' : 'Reason:'}</label>
                <textarea
                  rows={2}
                  placeholder={isBn ? 'যেমন: পারিবারিক জরুরি কাজ' : 'Reason for leave'}
                  value={newLeaveData.reason}
                  onChange={(e) => setNewLeaveData({ ...newLeaveData, reason: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-slate-900 flex justify-end gap-2 pt-3 pb-1 border-t border-slate-100 dark:border-slate-800 shrink-0">
                {/* Phase 5: leave-add failure keeps the modal open with
                    this inline error + re-confirm-only retry. */}
                {leaveError && (
                  <div className="w-full bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">{leaveError}</span>
                    <button
                      type="button"
                      onClick={handleRetryLeaveSave}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                      {isBn ? 'আবার চেষ্টা করুন' : 'Retry'}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setIsLeaveModalOpen(false); setLeaveError(null); }}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>{isBn ? 'ছুটি রেকর্ড করুন' : 'Approve Leave'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Experience / NOC Certificate Modal */}
      {isCertificateModalOpen && certificateTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 shrink-0 print:hidden">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <FileText size={18} className="text-teal-600" />
                <span>{isBn ? 'শিক্ষক প্রত্যয়নপত্র ও অভিজ্ঞতা সনদ' : 'Teacher Certificate of Service'}</span>
              </h3>
              <button onClick={() => setIsCertificateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {/* Printable Certificate Page */}
              <div className="border-4 border-double border-teal-800 p-8 rounded-2xl bg-amber-50/20 text-slate-900 font-bangla space-y-6">
                <div className="text-center border-b-2 border-teal-800/40 pb-4">
                  <h2 className="text-xl font-black text-teal-950">
                    {schoolProfile.nameBn || schoolProfile.name}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    {schoolProfile.addressBn || schoolProfile.address} • ফোন: {schoolProfile.phone}
                  </p>
                  <span className="inline-block mt-3 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-teal-900 text-white">
                    {isBn ? 'অভিজ্ঞতা ও চারিত্রিক প্রত্যয়নপত্র' : 'TO WHOM IT MAY CONCERN'}
                  </span>
                </div>

                <div className="text-sm leading-relaxed space-y-3 text-justify">
                  <p>
                    এই মর্মে প্রত্যয়ন করা যাইতেছে যে, <strong>{certificateTeacher.nameBn || certificateTeacher.name}</strong>, পদবি: <strong>{certificateTeacher.designation || 'সহকারী শিক্ষক'}</strong>, এই প্রতিষ্ঠানে অত্যন্ত সততা, নিষ্ঠা ও সুনামের সহিত পাঠদান কার্য পরিচালনা করিতেছেন।
                  </p>
                  <p>
                    তাহার নৈতিক চরিত্র উত্তম এবং তিনি প্রতিষ্ঠানের শৃঙ্খলা ও আদর্শ বজায় রাখিয়া সার্বিক দায়িত্ব পালন করিয়া আসিতেছেন। আমরা তাহার উজ্জ্বল ভবিষ্যৎ ও উত্তরোত্তর সমৃদ্ধি কামনা করি।
                  </p>
                </div>

                <div className="flex items-end justify-between pt-10 text-xs">
                  <div>
                    <div>তারিখ: {new Date().toLocaleDateString('bn-BD')}</div>
                    <div className="text-slate-500 font-mono text-[10px]">স্মারক নং: MDR/CERT/{certificateTeacher.id.slice(0, 5)}</div>
                  </div>

                  <div className="text-center">
                    <div className="w-32 border-b border-slate-800 mx-auto mb-1"></div>
                    <div className="font-bold">{schoolProfile.headMasterNameBn || schoolProfile.headMasterName || 'অধ্যক্ষ / সুপারিনটেনডেন্ট'}</div>
                    <div className="text-[10px] text-slate-600">{schoolProfile.nameBn || schoolProfile.name}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white flex justify-end gap-2 border-t border-slate-100 shrink-0 print:hidden">
              <button
                type="button"
                onClick={() => setIsCertificateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>{isBn ? 'সনদ প্রিন্ট করুন' : 'Print Certificate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
