import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  ShieldCheck, 
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
import { UserRoleManager } from '../UserRoleManager';
import { SubjectManager } from '../SubjectManager';
import { DailyAttendanceHub } from '../attendance/DailyAttendanceHub';
import { TeacherSalaryEntry } from '../finance/TeacherSalaryEntry';
import { dailyAttendanceService, DailyStaffAttendanceRecord } from '../../services/dailyAttendanceService';
import { AcademicTeacher } from '../../types/academic';
import { FinanceTransaction, UserRole, StaffLeaveRecord } from '../../types';
import { deriveRoleFromDesignation } from '../../services/utils';
import { PageHeader } from '../ui/PageHeader';

export type StaffSubTab = 
  | 'directory' 
  | 'roles' 
  | 'assignments' 
  | 'attendance' 
  | 'payroll' 
  | 'leaves' 
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
    deleteTeacher,
    staffLeaves = [],
    setStaffLeaves,
    users = [], 
    setUsers,
    pendingMembers = [],
    approveMember,
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
    isSuperAdmin 
  } = useApp();

  const isBn = language === 'bn';
  const [activeTab, setActiveTab] = useState<StaffSubTab>(initialSubTab);

  // Search and filter for Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'INACTIVE'>('ALL');

  // Add/Edit Teacher Modal
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<AcademicTeacher | null>(null);
  const [formLoginRole, setFormLoginRole] = useState<UserRole>('teacher');
  // Multi-role: extra roles held alongside the primary login role
  // (e.g. an accountant who also teaches). Saved to the staff record,
  // the linked login account and the member document together.
  const [formAdditionalRoles, setFormAdditionalRoles] = useState<UserRole[]>([]);
  const [teacherFormData, setTeacherFormData] = useState<Partial<AcademicTeacher>>({
    name: '',
    nameBn: '',
    employeeCode: '',
    designation: 'মুয়াল্লিম (সহকারী শিক্ষক)',
    phone: '',
    email: '',
    password: '123',
    status: 'ACTIVE',
    assignedClasses: [],
    assignedSubjects: []
  });

  // Leave Management State — records live in the shared, cloud-synced store
  // (AppContext staffLeaves) so they survive across devices and admins.
  const leaves = staffLeaves;
  const setLeaves = setStaffLeaves;

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [newLeaveData, setNewLeaveData] = useState<Partial<StaffLeaveRecord>>({
    teacherId: '',
    leaveType: 'CASUAL',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    daysCount: 1,
    reason: '',
    status: 'APPROVED'
  });

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

  // Staff removal (confirm dialog) + per-card password reveal
  const [staffToDelete, setStaffToDelete] = useState<AcademicTeacher | null>(null);
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

  // Today's staff attendance data
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayStaffAttendance = useMemo(() => {
    return dailyAttendanceService.getStaffAttendanceByDate(todayStr);
  }, [todayStr]);

  // Unified Staff list (merging teachers, staff roles from users, and pending members)
  const unifiedStaffList = useMemo(() => {
    const list: AcademicTeacher[] = [...teachers];
    // If teachers are empty or users have staff not in teachers, complement
    users.forEach(u => {
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
          additionalRoles: (u.additionalRoles || []) as string[],
          status: (u.status === 'pending') ? 'PENDING' : 'ACTIVE',
          assignedClasses: u.assignedClasses || []
        });
      }
    });

    // Also include pending registered members
    pendingMembers.forEach(m => {
      if (!list.some(t => t.id === m.uid || (m.email && t.email?.toLowerCase() === m.email.toLowerCase()))) {
        list.push({
          id: m.uid,
          name: m.displayName || 'Teacher',
          nameBn: m.displayName || 'শিক্ষক',
          designation: m.requestedRole || 'মুয়াল্লিম (সহকারী শিক্ষক)',
          phone: m.phone || '',
          email: m.email || '',
          status: 'PENDING',
          assignedClasses: m.assignedClasses || []
        });
      }
    });

    return list;
  }, [teachers, users, pendingMembers]);

  // List of pending staff awaiting approval
  const pendingStaffApprovals = useMemo(() => {
    return unifiedStaffList.filter(s => 
      s.status?.toUpperCase() === 'PENDING' ||
      pendingMembers.some(m => m.uid === s.id || (s.email && m.email?.toLowerCase() === s.email.toLowerCase()))
    );
  }, [unifiedStaffList, pendingMembers]);

  // Real-time KPI Calculations
  const kpis = useMemo(() => {
    const totalStaffCount = unifiedStaffList.length;
    const teachersOnlyCount = unifiedStaffList.filter(s =>
      deriveRoleFromDesignation(s.designation) === 'teacher'
    ).length;

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
      leavesTodayCount
    };
  }, [unifiedStaffList, todayStaffAttendance, transactions, todayStr, leaves]);

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
      const derivedRole = deriveRoleFromDesignation(s.designation);
      const matchRole = roleFilter === 'ALL' ||
        (roleFilter === 'TEACHER' && derivedRole === 'teacher') ||
        (roleFilter === 'OFFICE' && derivedRole !== 'teacher');

      return matchSearch && matchStatus && matchRole;
    });
  }, [unifiedStaffList, searchQuery, statusFilter, roleFilter]);

  // Handle open add modal
  const handleOpenAddModal = () => {
    setEditingTeacher(null);
    setFormLoginRole('teacher');
    setFormAdditionalRoles([]);
    setTeacherFormData({
      name: '',
      nameBn: '',
      employeeCode: `MDR-T${String(unifiedStaffList.length + 1).padStart(3, '0')}`,
      designation: 'মুয়াল্লিম (সহকারী শিক্ষক)',
      phone: '',
      email: '',
      password: '123',
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
    const primaryRole = (linkedUser?.role as UserRole) || deriveRoleFromDesignation(teacher.designation);
    setFormLoginRole(primaryRole);
    const storedAdditional =
      (linkedUser?.additionalRoles && linkedUser.additionalRoles.length > 0)
        ? linkedUser.additionalRoles
        : ((teacher.additionalRoles || []) as UserRole[]);
    setFormAdditionalRoles(storedAdditional.filter(r => r !== primaryRole));
    setTeacherFormData({
      ...teacher,
      password: teacher.password || '123'
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

  // Handle save teacher
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherFormData.name?.trim()) {
      showToast(isBn ? 'দয়া করে শিক্ষকের নাম প্রদান করুন' : 'Please provide staff name');
      return;
    }

    const rawPassword = teacherFormData.password?.trim() || '123';

    const additionalRoles = formAdditionalRoles.filter(r => r !== formLoginRole);

    if (editingTeacher) {
      const sync = await updateTeacher({
        ...editingTeacher,
        ...teacherFormData,
        name: teacherFormData.name.trim(),
        nameBn: teacherFormData.nameBn?.trim() || teacherFormData.name.trim(),
        password: rawPassword,
        additionalRoles
      } as AcademicTeacher, formLoginRole);
      if (sync.status === 'failed') {
        showToast(isBn ? `তথ্য আপডেট হয়েছে, তবে Firebase sync হয়নি (${syncFailureNote(sync.reason, true)})` : `Information updated, but Firebase sync failed (${sync.reason})`);
      } else if (sync.status === 'skipped' && sync.reason === 'no-email') {
        showToast(isBn ? 'তথ্য আপডেট হয়েছে; এই staff-এর email নেই বলে Firebase sync হয়নি' : 'Information updated; no email, so Firebase sync did not run');
      } else {
        showToast(isBn ? 'শিক্ষক/কর্মচারীর তথ্য সফলভাবে আপডেট হয়েছে' : 'Staff information updated successfully');
      }
    } else {
      const addRes = addTeacher({
        name: teacherFormData.name.trim(),
        nameBn: teacherFormData.nameBn?.trim() || teacherFormData.name.trim(),
        employeeCode: teacherFormData.employeeCode || `MDR-T${Date.now().toString().slice(-3)}`,
        designation: teacherFormData.designation || 'সহকারী শিক্ষক',
        phone: teacherFormData.phone || '',
        email: teacherFormData.email || '',
        password: rawPassword,
        status: teacherFormData.status || 'ACTIVE',
        additionalRoles,
        assignedClasses: teacherFormData.assignedClasses || [],
        assignedSubjects: teacherFormData.assignedSubjects || []
      }, formLoginRole);
      if (addRes && !addRes.success) {
        showToast(addRes.message || (isBn ? 'যুক্ত করা যায়নি — তথ্য যাচাই করুন' : 'Could not add — please check the information'));
        return;
      }
      showToast(isBn ? 'নতুন শিক্ষক/কর্মচারী ও লগইন অ্যাকাউন্ট সফলভাবে যুক্ত হয়েছে' : 'New staff member and login account added successfully');
    }

    setIsAddEditModalOpen(false);
  };

  // Handle 1-click approve staff
  const handleQuickApproveStaff = async (staff: AcademicTeacher) => {
    try {
      if (approveMember) {
        await approveMember(staff.id, `role_${deriveRoleFromDesignation(staff.designation)}`, staff.assignedClasses || [], staff.assignedSubjects || []);
      }
      updateTeacher({ ...staff, status: 'ACTIVE' });
      setUsers(prev => prev.map(u => (u.id === staff.id || (staff.email && u.email?.toLowerCase() === staff.email.toLowerCase())) ? { ...u, status: 'active' } : u));
      try {
        const stored = localStorage.getItem('madrasha_app_users');
        if (stored) {
          const list = JSON.parse(stored);
          const updated = list.map((u: any) => (u.id === staff.id || (staff.email && u.email?.toLowerCase() === staff.email.toLowerCase())) ? { ...u, status: 'active' } : u);
          localStorage.setItem('madrasha_app_users', JSON.stringify(updated));
        }
      } catch (e) {}

      if (refreshPendingMembers) {
        await refreshPendingMembers();
      }
      showToast(isBn ? 'শিক্ষকের অ্যাকাউন্ট সফলভাবে অনুমোদন ও সক্রিয় করা হয়েছে!' : 'Staff account approved successfully!');
    } catch (err: any) {
      showToast(isBn ? 'অনুমোদনে সমস্যা হয়েছে' : 'Approval failed');
    }
  };

  // Handle add leave
  const handleSaveLeave = (e: React.FormEvent) => {
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

    setLeaves(prev => [record, ...prev]);
    setIsLeaveModalOpen(false);
    showToast(isBn ? 'ছুটির আবেদন সফলভাবে রেকর্ড করা হয়েছে' : 'Leave record added successfully');
  };

  // Sub-tabs list
  const tabs = [
    { 
      id: 'directory' as StaffSubTab, 
      labelBn: '১. শিক্ষক ও কর্মী ডিরেক্টরি', 
      labelEn: '1. Faculty Directory', 
      icon: Users,
      badge: `${formatNumber(kpis.totalStaffCount, 'bn')}`
    },
    { 
      id: 'roles' as StaffSubTab, 
      labelBn: '২. রোল, একাউন্ট ও পারমিশন', 
      labelEn: '2. User Roles & Access', 
      icon: ShieldCheck, 
      badge: 'RBAC' 
    },
    { 
      id: 'assignments' as StaffSubTab, 
      labelBn: '৩. দায়িত্ব ও বিষয় বণ্টন', 
      labelEn: '3. Workload & Subjects', 
      icon: Briefcase 
    },
    { 
      id: 'attendance' as StaffSubTab, 
      labelBn: '৪. শিক্ষক-কর্মচারী দৈনিক হাজিরা', 
      labelEn: '4. Staff Daily Attendance', 
      icon: CalendarCheck,
      badge: kpis.attendanceRecorded ? `${kpis.staffAttendanceRate}%` : '—'
    },
    { 
      id: 'payroll' as StaffSubTab, 
      labelBn: '৫. বেতন ও মাসিক পে-রোল', 
      labelEn: '5. Payroll & Salary', 
      icon: CreditCard,
      badge: 'Pay'
    },
    { 
      id: 'leaves' as StaffSubTab, 
      labelBn: '৬. ছুটি ও ছুটির আবেদন', 
      labelEn: '6. Leave Records', 
      icon: Clock,
      badge: kpis.leavesTodayCount > 0 ? `${kpis.leavesTodayCount}` : undefined
    },
    { 
      id: 'id_cards' as StaffSubTab, 
      labelBn: '৭. স্টাফ আইডি কার্ড ও প্রত্যয়নপত্র', 
      labelEn: '7. ID Cards & NOC', 
      icon: Award, 
      badge: 'Print' 
    },
    { 
      id: 'analytics' as StaffSubTab, 
      labelBn: '৮. জনবল অ্যানালিটিক্স ও রিপোর্ট', 
      labelEn: '8. HR Analytics & Census', 
      icon: BarChart3, 
      badge: 'Report' 
    },
  ];

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
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
            >
              <UserPlus size={14} className="text-teal-300" />
              <span>{isBn ? '+ নতুন শিক্ষক যুক্ত' : 'Add Staff'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 border border-teal-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CalendarCheck size={14} />
              <span>{isBn ? 'দৈনিক স্টাফ হাজিরা' : 'Staff Attendance'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payroll')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard size={14} />
              <span>{isBn ? 'বেতন প্রদান' : 'Payroll'}</span>
            </button>
          </div>
      </PageHeader>

{/* Sub-Tabs Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-x-auto print:hidden">
        <div className="flex items-center gap-1.5 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-700 to-cyan-700 text-white shadow-xs'
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
        {/* 1. Staff & Faculty Directory */}
        {activeTab === 'directory' && (
          <div className="space-y-4">
            {/* Pending Approvals Notice for Staff */}
            {pendingStaffApprovals.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-300 dark:border-amber-700 rounded-3xl p-5 shadow-xs space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
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
                    <div key={staff.id} className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-amber-200 dark:border-amber-800 shadow-2xs flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{staff.nameBn || staff.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{staff.email || staff.phone || 'N/A'}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                          {staff.designation || 'সহকারী শিক্ষক'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickApproveStaff(staff)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <CheckCircle2 size={13} />
                        <span>✓ অনুমোদন করুন</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter and Search Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
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
                  <option value="ALL">{isBn ? 'সকল পদবি (All Roles)' : 'All Roles'}</option>
                  <option value="TEACHER">{isBn ? 'শুধু শিক্ষক / উস্তাদ' : 'Teachers Only'}</option>
                  <option value="OFFICE">{isBn ? 'অফিস ও হিসাব কর্মী' : 'Office & Staff'}</option>
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

                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>{isBn ? '+ নতুন শিক্ষক যুক্ত' : 'Add Staff'}</span>
                </button>
              </div>
            </div>

            {/* Staff Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((staff, idx) => (
                <div 
                  key={staff.id || idx} 
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-teal-300 transition-all space-y-4 relative group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        {(staff.nameBn || staff.name || 'উ')[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                          {isBn ? (staff.nameBn || staff.name) : staff.name}
                        </h4>
                        {Boolean(staff.status?.toUpperCase() === 'PENDING' || pendingMembers.some(m => m.uid === staff.id || (staff.email && m.email?.toLowerCase() === staff.email.toLowerCase()))) ? (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              {isBn ? 'অপেক্ষমাণ (Pending)' : 'Pending'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuickApproveStaff(staff)}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-xs cursor-pointer"
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
          </div>
        )}

        {/* 2. User Roles & Access Management */}
        {activeTab === 'roles' && (
          <div className="space-y-4">
            <UserRoleManager />
          </div>
        )}

        {/* 3. Workload & Subject Assignment */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <SubjectManager initialTab="teacher_assignment" />
          </div>
        )}

        {/* 4. Staff Daily Attendance */}
        {activeTab === 'attendance' && (
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
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 shadow-xs"
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

        {/* 6. Leave Records */}
        {activeTab === 'leaves' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Clock size={18} className="text-teal-600 dark:text-teal-400" />
                  <span>{isBn ? 'শিক্ষক ও কর্মচারী ছুটি রেজিস্টার' : 'Staff Leave & Absence Ledger'}</span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Clock size={14} />
                <span>{isBn ? '+ ছুটির আবেদন যোগ করুন' : 'Record Leave'}</span>
              </button>
            </div>

            {/* Leave Records Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
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
                          <button
                            type="button"
                            onClick={() => { setLeaves(prev => prev.filter(x => x.id !== l.id)); showToast(isBn ? 'ছুটির রেকর্ড মুছে ফেলা হয়েছে' : 'Leave record removed'); }}
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
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Award size={18} className="text-teal-600" />
                  <span>{isBn ? 'শিক্ষক ও কর্মচারী ডিজিটাল আইডি কার্ড' : 'Faculty & Staff Identity Cards'}</span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
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
                  className="bg-white border-2 border-teal-600/30 rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between max-w-sm mx-auto w-full aspect-[54/86] transition-all hover:shadow-xl"
                  style={{ minHeight: '380px' }}
                >
                  {/* Top Madrasah Branding Header */}
                  <div className="text-center border-b border-teal-100 pb-3">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-sm shadow-xs mb-1.5">
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
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 border-2 border-teal-600/40 flex items-center justify-center font-black text-2xl text-teal-800 shadow-inner">
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
              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
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

              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
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

              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{isBn ? 'হাজিরা ও কর্মদিবস সারসংক্ষেপ' : 'Attendance Summary'}</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'গড় স্টাফ উপস্থিতি হার:' : 'Avg Attendance Rate:'}</span>
                    <span className="font-bold text-teal-700 dark:text-teal-400">{kpis.attendanceRecorded ? `${kpis.staffAttendanceRate}%` : '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'অনুমোদিত মোট ছুটি (মাসিক):' : 'Total Leaves This Month:'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatNumber(leaves.length, 'bn')} টি</span>
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

      {/* Add / Edit Staff Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
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

            <form onSubmit={handleSaveTeacher} className="space-y-3 text-xs">
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
                  <input
                    type="text"
                    placeholder="মুয়াল্লিম / সহকারী শিক্ষক"
                    value={teacherFormData.designation || ''}
                    onChange={(e) => setTeacherFormData({ ...teacherFormData, designation: e.target.value })}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'আইডি / কোড:' : 'Employee Code:'}</label>
                  <input
                    type="text"
                    placeholder="MDR-T001"
                    value={teacherFormData.employeeCode || ''}
                    onChange={(e) => setTeacherFormData({ ...teacherFormData, employeeCode: e.target.value })}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
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
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{isBn ? 'উনি এই রোলেই লগইন করে নিজের পোর্টাল দেখবেন। উপরের পদবি শুধু প্রদর্শনের জন্য।' : 'They will log in with this role and see that portal. Designation above is display-only.'}</p>
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
                              ? 'bg-teal-600 text-white shadow-xs'
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
                    type="tel"
                    placeholder="017xxxxxxxx"
                    value={teacherFormData.phone || ''}
                    onChange={(e) => setTeacherFormData({ ...teacherFormData, phone: e.target.value })}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'ইমেইল:' : 'Email:'}</label>
                  <input
                    type="email"
                    placeholder="teacher@madrasha.edu.bd"
                    value={teacherFormData.email || ''}
                    onChange={(e) => setTeacherFormData({ ...teacherFormData, email: e.target.value })}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Login Password */}
              <div className="bg-teal-50/70 p-3 rounded-2xl border border-teal-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-teal-950 dark:text-teal-200 text-xs">
                    {isBn ? 'লগইন পাসওয়ার্ড (Login Password):' : 'Login Password:'} *
                  </label>
                  <span className="text-[10px] text-teal-700 dark:text-teal-400 bg-teal-100/70 px-2 py-0.5 rounded-full font-bold">
                    {isBn ? 'সরাসরি লগইনের জন্য' : 'For direct login'}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="যেমন: 123"
                  value={teacherFormData.password || '123'}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, password: e.target.value })}
                  className="w-full border border-teal-200 dark:border-teal-800 rounded-xl p-2.5 font-mono text-sm font-bold bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />

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
                            ? 'bg-teal-600 text-white shadow-xs' 
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-xs flex items-center gap-1.5"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">{isBn ? 'স্থায়ীভাবে মুছে ফেলবেন?' : 'Remove permanently?'}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'এই কাজটি আর ফেরত নেওয়া যাবে না' : 'This action cannot be undone'}</p>
              </div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/60 rounded-2xl p-3.5 text-xs text-slate-700 dark:text-slate-200 space-y-1">
              <p className="font-bold text-slate-900 dark:text-white text-sm">{staffToDelete.nameBn || staffToDelete.name}</p>
              <p>{staffToDelete.designation || (isBn ? 'সহকারী শিক্ষক' : 'Assistant Teacher')}{staffToDelete.phone ? ` · ${staffToDelete.phone}` : ''}</p>
              <p className="text-slate-500 dark:text-slate-400 pt-1">{isBn ? 'তার স্টাফ রেকর্ড, লগইন অ্যাকাউন্ট ও অ্যাক্সেস — সব একসাথে মুছে যাবে। পুরনো বেতন ও হাজিরার রেকর্ড আগের মতোই থাকবে।' : 'Their staff record, login account and access will all be removed together. Past salary and attendance records stay untouched.'}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold text-xs"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={isDeletingStaff}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs flex items-center gap-1.5 text-xs disabled:opacity-60"
              >
                <Trash2 size={13} />
                <span>{isDeletingStaff ? (isBn ? 'মোছা হচ্ছে...' : 'Removing...') : (isBn ? 'হ্যাঁ, মুছে ফেলুন' : 'Yes, remove')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                <Clock size={18} className="text-teal-600 dark:text-teal-400" />
                <span>{isBn ? 'ছুটির আবেদন ও এন্ট্রি' : 'Record Staff Leave'}</span>
              </h3>
              <button onClick={() => setIsLeaveModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLeave} className="space-y-3 text-xs">
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-xs flex items-center gap-1.5"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <FileText size={18} className="text-teal-600" />
                <span>{isBn ? 'শিক্ষক প্রত্যয়নপত্র ও অভিজ্ঞতা সনদ' : 'Teacher Certificate of Service'}</span>
              </h3>
              <button onClick={() => setIsCertificateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            {/* Printable Certificate Page */}
            <div className="border-4 border-double border-teal-800 p-8 rounded-2xl bg-amber-50/20 text-slate-900 font-bangla space-y-6">
              <div className="text-center border-b-2 border-teal-800/40 pb-4">
                <h2 className="text-xl font-black text-teal-950">
                  {schoolProfile.nameBn || schoolProfile.name}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  {schoolProfile.addressBn || schoolProfile.address} • ফোন: {schoolProfile.phone}
                </p>
                <span className="inline-block mt-3 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-teal-900 text-white shadow-xs">
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

            <div className="flex justify-end gap-2 pt-2 print:hidden">
              <button
                type="button"
                onClick={() => setIsCertificateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
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
