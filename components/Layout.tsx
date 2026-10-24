import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import { normalizeRoleKey, roleHomeTab } from '../services/roleResolution';
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  PenTool, 
  FileSpreadsheet, 
  Settings, 
  Menu, 
  X,
  Languages,
  Cloud,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Eye,
  LogOut,
  UserCheck,
  Wallet,
  Shield,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BarChart3,
  Sliders,
  Calendar,
  Award,
  CreditCard,
  Layers,
  Database,
  Megaphone,
  Search,
  Receipt,
  Landmark,
  UserPlus,
  Phone,
  FileText,
  UserMinus,
  Briefcase,
  Clock,
  Printer,
  QrCode,
  MessageSquare,
  Activity,
  Globe,
  HeartHandshake,
  Home,
  Library,
  Bus,
  CalendarDays,
  Trophy,
  Package,
  Boxes,
  HeartPulse,
  Palette,
  Sun,
  Moon,
  Bot
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { AdminAuthModal } from './AdminAuthModal';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { MobileMoreSheet } from './ui/MobileMoreSheet';
import { ThemeSwitcherModal } from './ui/ThemeSwitcherModal';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  subType: 'action' | 'report';
  permissions?: string[]; // Optional permissions; if any is granted, item is visible
  isSuperAdminOnly?: boolean;
  isAdminOnly?: boolean;
  badge?: string;
  isReportItem?: boolean;
}

interface NavGroup {
  id: string;
  categoryBn: string;
  categoryEn: string;
  icon: any;
  items: NavItem[];
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { 
    schoolProfile, 
    language, 
    setLanguage, 
    t, 
    cloudStatus, 
    isAdmin, 
    isSuperAdmin,
    hasPermission,
    adminEmail,
    authUser,
    currentUser,
    userRole,
    effectiveRoles,
    currentMember,
    logoutAdmin 
  } = useApp();

  const isOwnerEmail = (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isOwner = isSuperAdmin || isOwnerEmail || (currentUser?.role === 'super_admin');
  // Multi-role: principal held as an additional role counts as principal.
  const isPrincipal = currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal' || (effectiveRoles || []).includes('principal');
  const canAccessMasterAi = isOwner || isPrincipal;

  // Desktop home for the current user. Admin-tier users (owner / admin /
  // principal) keep the Dashboard exactly as before; every non-admin
  // role lands on its primary work module instead (teacher → attendance,
  // accountant → finance, staff → students, guardian → guardian_portal).
  const isAdminTier = isOwner || isAdmin || isPrincipal;
  const primaryRoleKey = normalizeRoleKey(currentUser?.role)
    || normalizeRoleKey(currentMember?.roleId)
    || normalizeRoleKey(userRole)
    || normalizeRoleKey((effectiveRoles || [])[0]);
  const homeTab = isAdminTier ? 'dashboard' : roleHomeTab(primaryRoleKey);

  // Guardian-ONLY session (guardian is the user's only role): their
  // entire menu is the self-service portal (own children only) plus
  // the shared notice board. Everything else in the catalogue is an
  // all-student or institutional surface. Multi-role users holding
  // guardian alongside a staff role keep the union menu.
  const isGuardianOnlySession = !isAdminTier
    && (effectiveRoles || []).includes('guardian')
    && (effectiveRoles || []).every(r => r === 'guardian');

  // Whether the slim desktop rail may offer a tab to this user — mirrors
  // the App.tsx tab gate + render guards for just these rail tabs, so a
  // role is never shown a rail button that bounces or dead-ends.
  const canOpenRailTab = (tab: string): boolean => {
    if (isAdminTier) return true;
    // Guardian-only: the rail offers the notice board next to the
    // portal home (added separately) — no all-student shortcuts.
    if (isGuardianOnlySession) return tab === 'notice_board';
    switch (tab) {
      case 'students': return hasPermission('students.view') || hasPermission('students.create');
      case 'attendance': return hasPermission('attendance.view') || hasPermission('attendance.create') || hasPermission('attendance.edit');
      case 'results': return hasPermission('marks.view') || hasPermission('marks.create') || hasPermission('reports.view');
      case 'finance': return hasPermission('finance.view') || hasPermission('fees.view') || hasPermission('payments.view');
      case 'class_routine': return hasPermission('academic.view') || hasPermission('subjects.view');
      case 'notice_board': return true;
      case 'settings': return hasPermission('institution.settings.view');
      default: return false;
    }
  };

  // Theme & Mobile Navigation Sheet states
  const { darkMode, toggleDarkMode } = useTheme();
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Sidebar is closed by default and opens on-demand when user clicks the menu button
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  // Close sidebar on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper function: Strictly check if a navigation item should be visible to the current user's role
  const isItemVisible = (item: NavItem): boolean => {

    // 1. Super Admin items only visible to Super Admin / SUPER_ADMIN_EMAIL
    if (item.isSuperAdminOnly) {
      return isSuperAdmin || isOwnerEmail;
    }

    // 2. Super Admin or Institution Admin has full access to all standard modules
    if (isSuperAdmin || isAdmin || isOwnerEmail || currentUser?.role === 'super_admin') {
      return true;
    }

    // 2b. Guardian-only sessions see exactly two items: their portal
    // (own children only) and the shared notice board. This runs
    // before the permission steps because the guardian template's
    // broad students.view / fees.view / marks.view grants would
    // otherwise surface the all-student managers and reports.
    if (isGuardianOnlySession) {
      return item.id === 'guardian_portal' || item.id === 'notice_board';
    }

    // 3. Admin-only items (e.g., user_roles, settings, admin_reports)
    if (item.isAdminOnly) {
      if (item.permissions && item.permissions.length > 0) {
        return item.permissions.some(p => hasPermission(p as any));
      }
      return false;
    }

    // 4. Role granular permissions check (e.g. teacher, accountant, staff)
    if (item.permissions && item.permissions.length > 0) {
      return item.permissions.some(p => hasPermission(p as any));
    }

    // 5. For non-admin, non-principal roles: hide administrative operations and HR hubs
    const isPrincipalUser = currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal' || userRole === 'principal' || (effectiveRoles || []).includes('principal');
    if (!isAdmin && !isSuperAdmin && !isOwnerEmail && !isPrincipalUser) {
      if (['fixed_assets', 'store_inventory', 'house_system', 'fuzala_alumni', 'health_medical'].includes(item.id)) {
        return false;
      }
      if (['staff_leaves', 'staff_id_cards', 'staff_payroll', 'staff_analytics', 'user_roles', 'staff_roles'].includes(item.id)) {
        return false;
      }
      if (['sms_gateway', 'boarding_mess', 'islamic_welfare'].includes(item.id)) {
        // Multi-role: accountant held as an additional role counts too.
        return userRole === 'accountant' || currentMember?.roleId === 'role_accountant' || (effectiveRoles || []).includes('accountant');
      }
      if (['student_tc', 'promotion', 'student_admission'].includes(item.id)) {
        return false;
      }
    }

    // 6. Open / general items
    return true;
  };

  // Structured Navigation Groups aligned with the 8-Menu Madrasah Management Framework
  const navGroups: NavGroup[] = [
    // ২. শিক্ষার্থী ব্যবস্থাপনা (Students)
    {
      id: 'students_section',
      categoryBn: '২. শিক্ষার্থী ব্যবস্থাপনা',
      categoryEn: '2. Student Management',
      icon: Users,
      items: [
        { 
          id: 'students', 
          label: language === 'bn' ? 'শিক্ষার্থী তালিকা' : 'Student Directory', 
          icon: Users, 
          subType: 'action',
          permissions: ['students.view', 'students.create', 'students.edit'] 
        },
        { 
          id: 'student_admission', 
          label: language === 'bn' ? 'নতুন ভর্তি ফরম' : 'New Admission', 
          icon: UserPlus, 
          subType: 'action',
          permissions: ['students.create'] 
        },
        { 
          id: 'admission_applications', 
          label: language === 'bn' ? 'ভর্তি আবেদন ও ট্র্যাকার' : 'Admission Applications', 
          icon: FileText, 
          subType: 'action',
          badge: 'Online',
          permissions: ['students.view', 'students.create'] 
        },
        { 
          id: 'class_wise_students', 
          label: language === 'bn' ? 'শ্রেণি ও শাখাভিত্তিক শিক্ষার্থী' : 'Class & Section Roster', 
          icon: Layers, 
          subType: 'action',
          permissions: ['students.view'] 
        },
        { 
          id: 'student_profile', 
          label: language === 'bn' ? 'শিক্ষার্থীর বিস্তারিত প্রোফাইল' : 'Student Profile & Details', 
          icon: GraduationCap, 
          subType: 'action'
        },
        { 
          id: 'guardian_info', 
          label: language === 'bn' ? 'অভিভাবকের তথ্য ও যোগাযোগ' : 'Guardian Directory', 
          icon: Phone, 
          subType: 'action',
          permissions: ['students.view'] 
        },
        { 
          id: 'promotion', 
          label: language === 'bn' ? 'শ্রেণি পরিবর্তন ও প্রমোশন' : 'Class Promotion & Transfer', 
          icon: Layers, 
          subType: 'action',
          badge: 'Admin',
          permissions: ['students.edit', 'students.create']
        },
        { 
          id: 'student_tc', 
          label: language === 'bn' ? 'শিক্ষার্থী ছাড়পত্র / TC' : 'Transfer Certificate (TC)', 
          icon: Award, 
          subType: 'action',
          permissions: ['students.edit'] 
        },
        { 
          id: 'former_students', 
          label: language === 'bn' ? 'সাবেক / প্রাক্তন শিক্ষার্থী' : 'Former Students', 
          icon: UserMinus, 
          subType: 'action',
          permissions: ['students.view'] 
        },
        { 
          id: 'student_id_cards', 
          label: language === 'bn' ? 'শিক্ষার্থী আইডি কার্ড ও সনদ' : 'ID Cards & Certificates', 
          icon: CreditCard, 
          subType: 'action',
          badge: 'Print'
        },
        { 
          id: 'student_reports', 
          label: language === 'bn' ? 'শিক্ষার্থী রিপোর্ট ও পরিসংখ্যান' : 'Student Reports & Census', 
          icon: BarChart3, 
          subType: 'report',
          badge: 'Report',
          permissions: ['students.view', 'reports.view'],
          isReportItem: true
        }
      ]
    },

    // ৩. একাডেমিক ব্যবস্থাপনা (Academics)
    {
      id: 'academic_section',
      categoryBn: '৩. একাডেমিক ব্যবস্থাপনা',
      categoryEn: '3. Academic Management',
      icon: BookOpen,
      items: [
        { 
          id: 'subjects', 
          label: language === 'bn' ? 'বিষয় ও কারিকুলাম' : 'Subjects & Curriculum', 
          icon: BookOpen, 
          subType: 'action',
          permissions: ['subjects.view', 'subjectAssignments.view'] 
        },
        { 
          id: 'class_section_setup', 
          label: language === 'bn' ? 'শ্রেণি, শাখা ও শ্রেণি শিক্ষক' : 'Classes & Sections Setup', 
          icon: Layers, 
          subType: 'action',
          permissions: ['classes.view', 'teachers.view'] 
        },
        { 
          id: 'teacher_assignment', 
          label: language === 'bn' ? 'শিক্ষক ও বিষয় বণ্টন' : 'Teacher-Subject Assignment', 
          icon: UserCheck, 
          subType: 'action',
          permissions: ['subjectAssignments.view', 'teachers.view'] 
        },
        { 
          id: 'class_routine', 
          label: language === 'bn' ? 'ক্লাস রুটিন ও সময়সূচি' : 'Class Routine & Timetable', 
          icon: Clock, 
          subType: 'action',
          badge: 'Live',
          permissions: ['academic.view', 'subjects.view'] 
        },
        { 
          id: 'syllabus_planner', 
          label: language === 'bn' ? 'সিলেবাস ও পাঠ পরিকল্পনা' : 'Syllabus & Lesson Plan', 
          icon: FileText, 
          subType: 'action',
          permissions: ['academic.view'] 
        },
        { 
          id: 'academic_calendar', 
          label: language === 'bn' ? 'একাডেমিক ক্যালেন্ডার ও ছুটি' : 'Academic Calendar & Holidays', 
          icon: Calendar, 
          subType: 'action',
          permissions: ['academic.view'] 
        },
        { 
          id: 'academic_reports', 
          label: language === 'bn' ? 'একাডেমিক অ্যানালিটিক্স ও রিপোর্ট' : 'Academic Analytics & Reports', 
          icon: BarChart3, 
          subType: 'report',
          badge: 'Report',
          isReportItem: true,
          permissions: ['reports.view', 'subjects.view']
        }
      ]
    },

    // ৪. উপস্থিতি ব্যবস্থাপনা (Attendance)
    {
      id: 'attendance_section',
      categoryBn: '৪. উপস্থিতি ব্যবস্থাপনা',
      categoryEn: '4. Attendance & Tracking',
      icon: Calendar,
      items: [
        { 
          id: 'attendance', 
          label: language === 'bn' ? 'শিক্ষার্থীর দৈনিক উপস্থিতি' : 'Daily Student Attendance', 
          icon: UserCheck, 
          subType: 'action',
          permissions: ['attendance.view', 'attendance.create', 'attendance.edit'] 
        },
        { 
          id: 'staff_attendance', 
          label: language === 'bn' ? 'শিক্ষক-কর্মচারীর উপস্থিতি' : 'Staff Daily Attendance', 
          icon: Briefcase, 
          subType: 'action',
          permissions: ['attendance.view', 'attendance.create'] 
        },
        { 
          id: 'absent_students', 
          label: language === 'bn' ? 'অনুপস্থিত তালিকা ও SMS' : 'Absentees & SMS Alert', 
          icon: Phone, 
          subType: 'action',
          permissions: ['attendance.view'] 
        },
        { 
          id: 'monthly_attendance_sheet', 
          label: language === 'bn' ? 'মাসিক হাজিরা শিট ও রেজিস্টার' : 'Monthly Attendance Sheet', 
          icon: FileSpreadsheet, 
          subType: 'action',
          badge: 'Print',
          permissions: ['attendance.view'] 
        },
        { 
          id: 'sync_exam_attendance', 
          label: language === 'bn' ? 'পরীক্ষার মার্কশিটে সিঙ্ক' : 'Sync to Exam Marksheet', 
          icon: Sparkles, 
          subType: 'action',
          badge: 'Auto',
          permissions: ['attendance.edit', 'marks.create'] 
        },
        { 
          id: 'attendance_reports', 
          label: language === 'bn' ? 'হাজিরা রিপোর্ট ও অ্যানালিটিক্স' : 'Attendance Reports & Analytics', 
          icon: BarChart3, 
          subType: 'report',
          badge: 'Report',
          permissions: ['attendance.view', 'reports.view'],
          isReportItem: true
        }
      ]
    },

    // ৫. হিসাব ও ফি ব্যবস্থাপনা (Finance)
    {
      id: 'finance_section',
      categoryBn: '৫. হিসাব ও ফি ব্যবস্থাপনা',
      categoryEn: '5. Finance & Accounts',
      icon: Wallet,
      items: [
        { 
          id: 'finance', 
          label: language === 'bn' ? 'ফি আদায় ও ক্যাশ লেনদেন' : 'Fee Collection & Cashbook', 
          icon: Wallet, 
          subType: 'action',
          permissions: ['finance.view', 'fees.view', 'payments.view'] 
        },
        {
          id: 'fee_structure',
          label: language === 'bn' ? 'ফি কাঠামো ও রেট চার্ট' : 'Fee Structure & Rates',
          icon: Sliders,
          subType: 'action',
          // The accountant's core rate chart: gate + render both allow it
          // via finance.view, so it must be visible to finance roles
          // (previously isAdminOnly hid it from everyone non-admin).
          permissions: ['finance.view']
        },
        { 
          id: 'finance_reports', 
          label: language === 'bn' ? 'আর্থিক বিবরণী ও খতিয়ান' : 'Financial Statements & Reports', 
          icon: FileSpreadsheet, 
          subType: 'report',
          badge: 'Report',
          permissions: ['finance.view', 'reports.view'],
          isReportItem: true
        },
        { 
          id: 'islamic_welfare', 
          label: language === 'bn' ? 'ছাত্রকল্যাণ ও উপবৃত্তি তহবিল' : 'Student Welfare & Stipends', 
          icon: HeartHandshake, 
          subType: 'report',
          badge: 'Welfare'
        }
      ]
    },

    // ৬. পরীক্ষা ও ফলাফল (Exams & Results)
    {
      id: 'examination_section',
      categoryBn: '৬. পরীক্ষা ও ফলাফল',
      categoryEn: '6. Exams & Results',
      icon: Award,
      items: [
        { 
          id: 'exam_settings', 
          label: language === 'bn' ? 'পরীক্ষা ও টার্ম সেটআপ' : 'Exams & Terms Setup', 
          icon: Layers, 
          subType: 'action',
          badge: 'Admin',
          isAdminOnly: true
        },
        { 
          id: 'marks', 
          label: language === 'bn' ? 'নম্বর এন্ট্রি ও মূল্যায়ন' : 'Marks Entry & Evaluation', 
          icon: PenTool, 
          subType: 'action',
          permissions: ['marks.view', 'marks.create', 'marks.edit'] 
        },
        { 
          id: 'blank_marksheet', 
          label: language === 'bn' ? 'ব্লাঙ্ক মার্কশিট প্রিন্ট' : 'Blank Marksheet Print', 
          icon: Printer, 
          subType: 'action',
          badge: 'Print',
          permissions: ['marks.view', 'marks.create'] 
        },
        { 
          id: 'results', 
          label: language === 'bn' ? 'একক ফলাফল ও মার্কশিট' : 'Individual Marksheets', 
          icon: Award, 
          subType: 'action',
          permissions: ['marks.view', 'marks.create', 'reports.view']
        },
        { 
          id: 'tabulation_sheet', 
          label: language === 'bn' ? 'মেধাতালিকা ও ট্যাবুলেশন' : 'Merit Tabulation Sheet', 
          icon: FileSpreadsheet, 
          subType: 'action',
          badge: 'Merit',
          permissions: ['marks.view', 'reports.view']
        },
        { 
          id: 'web_results', 
          label: language === 'bn' ? 'অনলাইন রেজাল্ট ও কিউআর' : 'Web Results & QR Verification', 
          icon: QrCode, 
          subType: 'action'
        },
        { 
          id: 'result_sms', 
          label: language === 'bn' ? 'ফলাফল SMS অ্যালার্ট' : 'Result SMS Alerts', 
          icon: MessageSquare, 
          subType: 'action',
          badge: 'SMS',
          permissions: ['marks.view']
        },
        { 
          id: 'exam_analytics', 
          label: language === 'bn' ? 'ফলাফল অ্যানালিটিক্স ও রিপোর্ট' : 'Exam Analytics & Reports', 
          icon: BarChart3, 
          subType: 'report',
          badge: 'Report',
          isReportItem: true,
          permissions: ['marks.view', 'reports.view']
        }
      ]
    },

    // ৭. শিক্ষক ও কর্মচারী (Staff & HR)
    {
      id: 'staff_section',
      categoryBn: '৭. শিক্ষক ও কর্মচারী',
      categoryEn: '7. Staff & HR Management',
      icon: UserCheck,
      items: [
        { 
          id: 'user_roles', 
          label: language === 'bn' ? 'শিক্ষক ও কর্মী ডিরেক্টরি' : 'Staff Directory', 
          icon: Users, 
          subType: 'action',
          permissions: ['roles.view', 'users.view', 'teachers.view']
        },
        { 
          id: 'staff_roles', 
          label: language === 'bn' ? 'রোল, একাউন্ট ও পারমিশন' : 'User Roles & Access', 
          icon: ShieldCheck, 
          subType: 'action',
          badge: 'Admin',
          isAdminOnly: true,
          permissions: ['roles.view', 'users.view']
        },
        { 
          id: 'staff_assignments', 
          label: language === 'bn' ? 'দায়িত্ব ও বিষয় বণ্টন' : 'Workload & Subjects', 
          icon: Briefcase, 
          subType: 'action',
          permissions: ['subjects.view', 'teachers.view']
        },
        {
          id: 'staff_payroll',
          label: language === 'bn' ? 'বেতন ও মাসিক পে-রোল' : 'Payroll & Salary',
          icon: CreditCard,
          subType: 'action',
          badge: 'Pay',
          // finance.view only: with fees.view here, GUARDIANS (who hold
          // fees.view for their child's fees) were shown the staff salary
          // module. The accountant keeps it via finance.view.
          permissions: ['finance.view']
        },
        { 
          id: 'staff_leaves', 
          label: language === 'bn' ? 'ছুটি ও ছুটির আবেদন' : 'Staff Leave Records', 
          icon: Clock, 
          subType: 'action'
        },
        { 
          id: 'staff_id_cards', 
          label: language === 'bn' ? 'স্টাফ আইডি কার্ড ও প্রত্যয়ন' : 'Staff ID Cards & NOC', 
          icon: Award, 
          subType: 'action',
          badge: 'Print'
        },
        { 
          id: 'staff_analytics', 
          label: language === 'bn' ? 'জনবল অ্যানালিটিক্স ও রিপোর্ট' : 'HR Analytics & Census', 
          icon: BarChart3, 
          subType: 'report',
          badge: 'Report',
          isReportItem: true,
          permissions: ['reports.view']
        }
      ]
    },

    // ৮. নোটিশ ও রিপোর্ট (Notices & Reports)
    {
      id: 'notices_reports_section',
      categoryBn: '৮. নোটিশ ও রিপোর্ট',
      categoryEn: '8. Notices & Reports',
      icon: Megaphone,
      items: [
        { 
          id: 'notice_board', 
          label: language === 'bn' ? 'নোটিশ বোর্ড ও জরুরি বার্তা' : 'Notice Board & Alerts', 
          icon: Megaphone, 
          subType: 'action'
        },
        { 
          id: 'admin_reports', 
          label: language === 'bn' ? 'সার্বিক প্রশাসনিক রিপোর্ট' : 'Consolidated Institutional Reports', 
          icon: BarChart3, 
          subType: 'report',
          badge: 'Report',
          isAdminOnly: true,
          isReportItem: true
        }
      ]
    },

    // ৯. সেটিংস ও সিস্টেম (Settings & System)
    {
      id: 'settings_reports_section',
      categoryBn: '৯. সেটিংস ও সিস্টেম',
      categoryEn: '9. Settings & System',
      icon: Settings,
      items: [
        { 
          id: 'settings', 
          label: language === 'bn' ? 'মাদ্রাসা প্রোফাইল ও পরিচিতি' : 'Madrasah Profile Settings', 
          icon: Settings, 
          subType: 'action',
          badge: 'Admin',
          isAdminOnly: true,
          permissions: ['institution.settings.view']
        },
        { 
          id: 'branding_settings', 
          label: language === 'bn' ? 'সিল, স্বাক্ষর ও ব্র্যান্ডিং' : 'Seal, Signature & Branding', 
          icon: Sliders, 
          subType: 'action',
          badge: 'Seal',
          isAdminOnly: true,
          permissions: ['institution.settings.view']
        },
        { 
          id: 'backup_recovery', 
          label: language === 'bn' ? 'ডাটা সুরক্ষা ও ব্যাকআপ কেন্দ্র' : 'Data Safety & Backup Hub', 
          icon: Database, 
          subType: 'action',
          badge: 'Safe',
          isAdminOnly: true
        },
        { 
          id: 'superadmin_audit', 
          label: language === 'bn' ? 'সিকিউরিটি ও অডিট ট্রেইল' : 'Security Audit Trail', 
          icon: ShieldCheck, 
          subType: 'report',
          badge: 'Super',
          isSuperAdminOnly: true
        },
        {
          id: 'system_diagnostics',
          label: language === 'bn' ? 'সিস্টেম ও ডাটাবেজ স্থিতি' : 'System & Cloud Diagnostics',
          icon: Activity,
          subType: 'report',
          badge: 'Status',
          // Gate + render both restrict this to admin/super-admin; it was
          // visible to every non-admin role and only bounced them.
          isAdminOnly: true
        }
      ]
    },

    // ১০. পোর্টাল ও যোগাযোগ (Portals & Communication)
    {
      id: 'portals_services_section',
      categoryBn: '১০. পোর্টাল ও যোগাযোগ',
      categoryEn: '10. Portals & Communication',
      icon: Globe,
      items: [
        { 
          id: 'guardian_portal', 
          label: language === 'bn' ? 'অভিভাবক ও শিক্ষার্থী পোর্টাল' : 'Guardian & Student Portal', 
          icon: Users, 
          subType: 'action',
          badge: 'Live'
        },
        { 
          id: 'online_admissions', 
          label: language === 'bn' ? 'অনলাইন ভর্তি আবেদন ও ট্র্যাকার' : 'Online Admission Tracker', 
          icon: FileText, 
          subType: 'action',
          badge: 'Online'
        },
        { 
          id: 'public_web_results', 
          label: language === 'bn' ? 'অনলাইন রেজাল্ট ও কিউআর যাচাই' : 'Web Results & QR Gateway', 
          icon: QrCode, 
          subType: 'action'
        },
        { 
          id: 'sms_gateway', 
          label: language === 'bn' ? 'এসএমএস অ্যালার্ট ও গেটওয়ে' : 'SMS Alerts & Gateway', 
          icon: MessageSquare, 
          subType: 'action',
          badge: 'SMS'
        }
      ]
    },

    // ১১. লাইব্রেরি, পরিবহন ও বার্ষিক অনুষ্ঠান (Library, Transport & Annual Events Hub)
    {
      id: 'specialized_services_section',
      categoryBn: '১১. লাইব্রেরি, পরিবহন ও বার্ষিক অনুষ্ঠান',
      categoryEn: '11. Library, Transport & Annual Events',
      icon: Library,
      items: [
        { 
          id: 'book_bank', 
          label: language === 'bn' ? 'লাইব্রেরি ও পাঠ্যবই ব্যাংক' : 'Library & Textbook Bank', 
          icon: BookOpen, 
          subType: 'action',
          badge: 'Books'
        },
        { 
          id: 'book_issues', 
          label: language === 'bn' ? 'বই ইস্যু ও ফেরত রেজিস্টার' : 'Book Issues & Returns Register', 
          icon: Library, 
          subType: 'action',
          badge: 'Active'
        },
        { 
          id: 'transport_fleet', 
          label: language === 'bn' ? 'পরিবহন বহর ও বাস রুট' : 'Transport Fleet & Routes', 
          icon: Bus, 
          subType: 'action',
          badge: 'Route'
        },
        { 
          id: 'mahfil_events', 
          label: language === 'bn' ? 'বার্ষিক ক্রীড়া, সাংস্কৃতিক ও সিরাত মাহফিল' : 'Annual Sports, Culture & Events', 
          icon: CalendarDays, 
          subType: 'action',
          badge: 'Event'
        },
        { 
          id: 'activities_clubs', 
          label: language === 'bn' ? 'সহশিক্ষা ও ক্লাব ফোরাম' : 'Co-Curricular & Clubs', 
          icon: Trophy, 
          subType: 'report',
          badge: 'Club'
        }
      ]
    },

    // ১২. সম্পদ, হাউজ সিস্টেম ও অ্যালামনাই হাব (Institutional Operations Hub)
    {
      id: 'institutional_operations_section',
      categoryBn: '১২. সম্পদ, হাউজ সিস্টেম ও অ্যালামনাই হাব',
      categoryEn: '12. Assets, Houses, Alumni & Health',
      icon: Package,
      items: [
        { 
          id: 'fixed_assets', 
          label: language === 'bn' ? 'স্থায়ী সম্পদ ও আসবাবপত্র' : 'Fixed Assets & Property', 
          icon: Package, 
          subType: 'action',
          badge: 'Asset'
        },
        { 
          id: 'store_inventory', 
          label: language === 'bn' ? 'স্টোর ইনভেন্টরি ও কনজিউমেবল' : 'Store & Consumables', 
          icon: Boxes, 
          subType: 'action',
          badge: 'Store'
        },
        { 
          id: 'house_system', 
          label: language === 'bn' ? 'হাউজ সিস্টেম ও হোস্টেল উইং' : 'House Wings & Points', 
          icon: Shield, 
          subType: 'action',
          badge: 'House'
        },
        { 
          id: 'fuzala_alumni', 
          label: language === 'bn' ? 'প্রাক্তন শিক্ষার্থী (অ্যালামনাই) পরিষদ' : 'Alumni Association', 
          icon: GraduationCap, 
          subType: 'action',
          badge: 'Alumni'
        },
        { 
          id: 'health_medical', 
          label: language === 'bn' ? 'স্বাস্থ্যসেবা ও ফার্স্ট এইড লগ' : 'Health & First Aid Log', 
          icon: HeartPulse, 
          subType: 'report',
          badge: 'Health'
        },
        { 
          id: 'boarding_mess', 
          label: language === 'bn' ? 'ছাত্রাবাস ও হোস্টেল ডাইনিং' : 'Hostel & Mess Dining', 
          icon: Home, 
          subType: 'action'
        }
      ]
    }
  ];

  const toggleGroup = (groupId: string) => {
    setExpandedGroupId(prev => (prev === groupId ? null : groupId));
  };

  const handleTabClick = (itemId: string) => {
    setActiveTab(itemId);
    setIsSidebarOpen(false); // Cleanly close drawer upon item selection
  };

  const getRoleBadgeTitle = () => {
    if (isSuperAdmin) return '👑 Super Admin';
    if (currentMember?.roleId === 'role_principal') return '🎓 অধ্যক্ষ / সুপারিনটেনডেন্ট (Principal)';
    if (currentMember?.roleId === 'role_accountant') return '💼 হিসাবরক্ষক (Cashier)';
    if (currentMember?.roleId === 'role_teacher') return '👨‍🏫 সহকারী শিক্ষক (Teacher)';
    if (currentMember?.roleId === 'role_guardian') return '👨‍👩‍👧 অভিভাবক (Guardian)';
    if (isAdmin) return '🛡️ প্রতিষ্ঠান অ্যাডমিন';
    return '👤 সাধারণ ব্যবহারকারী';
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans relative">
      {/* Dimmed Overlay Backdrop when Sidebar is opened */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        />
      )}

      {/* Modern Slide-In Drawer Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-slate-900 text-white shadow-2xl border-r border-slate-800 transform transition-transform duration-300 ease-out flex flex-col justify-between ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Header */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0">
                <GraduationCap size={20} />
              </div>
              <div className="overflow-hidden">
                <span className="font-bold text-sm block truncate text-white">
                  {schoolProfile.nameBn || schoolProfile.name}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close Menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="p-3.5 m-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                  {(authUser?.displayName || (isOwnerEmail ? 'Mehedi' : authUser?.email) || 'U')[0].toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <span className="text-xs font-semibold block truncate text-slate-200">
                    {authUser?.displayName || (isOwnerEmail ? 'Mehedi Hasan Sagor' : authUser?.email?.split('@')[0])}
                  </span>
                  <span className="text-[11px] text-slate-400 block truncate">
                    {authUser?.email}
                  </span>
                </div>
              </div>

              <button
                onClick={() => { logoutAdmin(); setIsSidebarOpen(false); }}
                title={language === 'bn' ? 'লগআউট' : 'Sign Out'}
                className="p-1.5 rounded-lg bg-slate-700 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 transition-colors cursor-pointer shrink-0 ml-1"
              >
                <LogOut size={13} />
              </button>
            </div>

            {/* Role Badge */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-700/60 text-xs">
              <span className="font-medium text-indigo-300 flex items-center gap-1.5">
                <Shield size={12} className={isSuperAdmin ? 'text-purple-400' : 'text-emerald-400'} />
                {getRoleBadgeTitle()}
              </span>
              {currentMember?.roleId === 'role_teacher' && currentMember.assignedClasses && currentMember.assignedClasses.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-[10px] text-indigo-300 font-semibold">
                  {currentMember.assignedClasses.length} শ্রেণি
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Categorized Navigation Menu with Subsections */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 custom-scrollbar">
          {/* Quick Module Search Input */}
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text"
              value={menuSearchQuery}
              onChange={(e) => setMenuSearchQuery(e.target.value)}
              placeholder={language === 'bn' ? 'মডিউল বা মেনু খুঁজুন...' : 'Search modules & tools...'}
              className="w-full pl-8 pr-7 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {menuSearchQuery && (
              <button 
                onClick={() => setMenuSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Top-Level Home Button — Dashboard for admin-tier users;
              for non-admin roles it points at their role home instead. */}
          {!menuSearchQuery && (
            <button
              onClick={() => handleTabClick(homeTab)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                activeTab === homeTab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-6 h-6 rounded flex items-center justify-center ${activeTab === homeTab ? 'bg-white/20 text-white' : 'text-indigo-400'}`}>
                  {homeTab === 'dashboard' ? <LayoutDashboard size={15} /> : <Home size={15} />}
                </div>
                <span>{homeTab === 'dashboard'
                  ? (language === 'bn' ? '১. ড্যাশবোর্ড (সারসংক্ষেপ)' : '1. Dashboard (Overview)')
                  : (language === 'bn' ? '১. হোম' : '1. Home')}</span>
              </div>
              {activeTab === homeTab ? (
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              ) : (
                <ChevronRight size={13} className="text-slate-500" />
              )}
            </button>
          )}

          {/* Persistent Premium 'Master AI Principal' Entry Point (Exclusively for Owner and Principal roles) */}
          {canAccessMasterAi && (!menuSearchQuery || ['ai', 'এআই', 'master', 'মাস্টার', 'principal', 'প্রিন্সিপাল'].some(k => menuSearchQuery.toLowerCase().includes(k))) && (
            <div className="pt-2">
              <button
                onClick={() => handleTabClick('ai_principal_advisor')}
                className={`w-full p-3 rounded-2xl text-left transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] border ${
                  activeTab === 'ai_principal_advisor'
                    ? 'bg-gradient-to-r from-amber-500/25 via-indigo-600 to-indigo-800 text-white border-amber-400 shadow-xl shadow-indigo-950 ring-2 ring-amber-400/40'
                    : 'bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 hover:from-slate-800 hover:to-indigo-900 text-slate-100 border-indigo-700/60 hover:border-amber-400/80 shadow-md shadow-indigo-950/50'
                }`}
              >
                {/* Subtle ambient amber glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none -mr-6 -mt-6 group-hover:bg-amber-400/25 transition-all" />

                <div className="flex items-center justify-between gap-2 relative z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Modern icon container with pulsing live dot */}
                    <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-600 p-0.5 shadow-md shrink-0">
                      <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-300">
                        <Bot size={18} className="group-hover:rotate-6 transition-transform text-amber-400" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 ring-2 ring-slate-900" />
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black tracking-tight text-white truncate block">
                          {language === 'bn' ? 'মাস্টার এআই প্রিন্সিপাল' : 'Master AI Principal'}
                        </span>
                        <Sparkles size={12} className="text-amber-400 shrink-0 animate-pulse" />
                      </div>
                      <span className="text-[10px] text-indigo-300 block truncate font-medium">
                        {language === 'bn' ? 'প্রাতিষ্ঠানিক কমান্ড ও কোপাইলট' : 'Executive Cockpit & Copilot'}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-md text-[9px] bg-amber-400 text-slate-950 font-black tracking-wider uppercase shrink-0 shadow-xs">
                    PRO
                  </span>
                </div>
              </button>
            </div>
          )}

          {!menuSearchQuery && <div className="h-px bg-slate-800 my-1" />}

          {(navGroups || []).map((group, gIdx) => {
            // Strictly filter visible items based on current user's role and granular permissions
            const visibleItems = (group?.items || []).filter(item => {
              if (!isItemVisible(item)) return false;
              if (!menuSearchQuery) return true;
              const q = menuSearchQuery.toLowerCase().trim();
              return item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
            });

            // If user has no permission or search match for any item in this group, hide the whole category section
            if (visibleItems.length === 0) return null;

            const isExpanded = menuSearchQuery ? true : (expandedGroupId === group.id);
            const hasActiveChild = visibleItems.some(item => item.id === activeTab);

            return (
              <div key={gIdx} className="space-y-1">
                {/* Category Header with Toggle & Icon */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-between transition-all cursor-pointer ${
                    isExpanded 
                      ? 'bg-slate-800 text-white' 
                      : hasActiveChild 
                      ? 'bg-indigo-950/40 text-indigo-300' 
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <group.icon size={14} className={isExpanded || hasActiveChild ? 'text-indigo-400' : 'text-slate-400'} />
                    <span>{language === 'bn' ? group.categoryBn : group.categoryEn}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasActiveChild && !isExpanded && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    )}
                    <ChevronDown 
                      size={13} 
                      className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} 
                    />
                  </div>
                </button>

                {/* Submenu Items - Only shown when category is clicked/expanded */}
                {isExpanded && (
                  <div className="space-y-0.5 pl-2 border-l border-slate-800 ml-3 my-1">
                    {visibleItems.map((item) => {
                      const isActive = activeTab === item.id;
                      const badgeText = item.badge || (item.isReportItem ? 'Report' : null);

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleTabClick(item.id)}
                          className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium transition-all group cursor-pointer ${
                            isActive 
                              ? 'bg-indigo-600 text-white font-bold shadow-xs' 
                              : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <item.icon 
                              size={14} 
                              className={`shrink-0 ${
                                isActive 
                                ? 'text-white' 
                                : item.subType === 'report'
                                ? 'text-teal-400'
                                : 'text-slate-400 group-hover:text-indigo-400'
                              }`} 
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-1">
                            {badgeText && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                badgeText.toLowerCase() === 'super'
                                  ? isActive 
                                    ? 'bg-white/20 text-white border-white/30' 
                                    : 'bg-purple-950 text-purple-300 border-purple-800/60'
                                  : badgeText.toLowerCase() === 'admin'
                                  ? isActive 
                                    ? 'bg-white/20 text-white border-white/30' 
                                    : 'bg-sky-950 text-sky-300 border-sky-800/60'
                                  : isActive
                                  ? 'bg-white/20 text-white border-white/30'
                                  : 'bg-teal-950 text-teal-300 border-teal-800/60'
                              }`}>
                                {language === 'bn' 
                                  ? (badgeText === 'Super' ? 'সুপার' : badgeText === 'Admin' ? 'অ্যাডমিন' : 'রিপোর্ট')
                                  : badgeText}
                              </span>
                            )}
                            <ChevronRight size={12} className={`transition-transform ${isActive ? 'text-white translate-x-0.5' : 'text-slate-600 opacity-0 group-hover:opacity-100'}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>লাইভ ডাটাবেস</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
          >
            বন্ধ করুন (Esc)
          </button>
        </div>
      </aside>

      {/* Modern Desktop Slim Sidebar (Linear / Stripe inspired clean aesthetic) */}
      <aside className="hidden md:flex flex-col w-16 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 shrink-0 z-20 justify-between items-center py-3 select-none">
        {/* Top: Institution Brand Icon */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          <button
            type="button"
            onClick={() => handleTabClick(homeTab)}
            className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={schoolProfile.nameBn || schoolProfile.name}
            style={{ backgroundColor: 'var(--color-brand, #4f46e5)' }}
          >
            <GraduationCap size={20} />
          </button>

          {/* Persistent Premium 'Master AI Principal' Entry Point (Exclusively for Owner & Principal roles) */}
          {canAccessMasterAi && (
            <div className="w-full px-2 flex justify-center">
              <button
                type="button"
                onClick={() => handleTabClick('ai_principal_advisor')}
                title={language === 'bn' ? 'মাস্টার এআই প্রিন্সিপাল • এক্সিকিউটিভ কমান্ড হাব' : 'Master AI Principal • Executive Intelligence'}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative group active:scale-95 ${
                  activeTab === 'ai_principal_advisor'
                    ? 'bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-700 text-white shadow-lg shadow-indigo-600/40 ring-2 ring-amber-400 scale-105'
                    : 'bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-800 dark:via-indigo-950 dark:to-slate-800 text-amber-400 border border-amber-400/50 hover:border-amber-400 shadow-md shadow-indigo-950/40 hover:scale-105'
                }`}
              >
                <Bot size={20} className={activeTab === 'ai_principal_advisor' ? 'stroke-[2.5]' : 'stroke-[2] text-amber-400 group-hover:rotate-6 transition-transform'} />
                
                {/* Live pulsing amber radar indicator */}
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 ring-2 ring-white dark:ring-slate-900" />
                </span>

                {/* Left active indicator pill */}
                {activeTab === 'ai_principal_advisor' && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-amber-400" />
                )}
              </button>
            </div>
          )}

          <div className="w-8 h-px bg-slate-200 dark:bg-slate-800 my-0.5" />

          {/* Quick Nav Icon Buttons with tooltips */}
          <div className="flex flex-col items-center gap-1.5 w-full px-2">
            {[
              // First entry is the user's home: 'dashboard' for admin-tier,
              // the role home for non-admin roles. The other entries use
              // REAL tab ids ('routine'/'notices' were bogus ids that set a
              // non-existent tab and fell through to the Dashboard) and are
              // filtered to tabs this role can actually open.
              { id: homeTab, label: homeTab === 'dashboard' ? (language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard') : (language === 'bn' ? 'হোম' : 'Home'), icon: homeTab === 'dashboard' ? LayoutDashboard : Home },
              { id: 'students', label: language === 'bn' ? 'শিক্ষার্থী' : 'Students', icon: Users },
              { id: 'attendance', label: language === 'bn' ? 'হাজিরা' : 'Attendance', icon: UserCheck },
              { id: 'results', label: language === 'bn' ? 'ফলাফল' : 'Results', icon: Award },
              { id: 'finance', label: language === 'bn' ? 'হিসাব' : 'Finance', icon: Wallet },
              { id: 'class_routine', label: language === 'bn' ? 'রুটিন' : 'Routine', icon: CalendarDays },
              { id: 'notice_board', label: language === 'bn' ? 'নোটিশ' : 'Notices', icon: Megaphone },
              { id: 'settings', label: language === 'bn' ? 'সেটিংস' : 'Settings', icon: Settings }
            ].filter(item => item.id === homeTab || canOpenRailTab(item.id)).map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  title={item.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group active:scale-95 ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  style={isActive ? { color: 'var(--color-brand, #4f46e5)' } : undefined}
                >
                  <Icon size={18} className={isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                      style={{ backgroundColor: 'var(--color-brand, #4f46e5)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Tools in Slim Sidebar: Full Drawer button, Theme switcher, Dark mode toggle */}
        <div className="flex flex-col items-center gap-2 w-full px-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
          {/* Full Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            title={language === 'bn' ? 'সকল মেনু ও মডিউল' : 'All Modules'}
            className="w-10 h-10 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <Menu size={18} />
          </button>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={() => setIsThemeModalOpen(true)}
            title={language === 'bn' ? 'কালার থিম কাস্টমাইজ' : 'Accent Theme'}
            className="w-10 h-10 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <Palette size={18} />
          </button>

          {/* Dark Mode Button */}
          <button
            type="button"
            onClick={toggleDarkMode}
            title={darkMode ? (language === 'bn' ? 'লাইট মোড' : 'Light Mode') : (language === 'bn' ? 'ডার্ক মোড' : 'Dark Mode')}
            className="w-10 h-10 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            {darkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 z-30 print:hidden shadow-xs sticky top-0 transition-colors">
          <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 gap-2">
            
            {/* Left: Interactive Menu Button & Institution Header */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                title="Open Navigation Menu"
              >
                <Menu size={16} className="text-indigo-400" />
                <span className="hidden xs:inline">{language === 'bn' ? 'মেনু' : 'Menu'}</span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    {language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}
                  </h1>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-400 truncate max-w-[200px] sm:max-w-md hidden sm:block">
                  {schoolProfile.address}
                </p>
              </div>
            </div>

            {/* Right Tools & Mode Switcher */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Theme Customizer Button (Palette modal) */}
              <button
                type="button"
                onClick={() => setIsThemeModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer min-h-[36px]"
                title={language === 'bn' ? 'ডিজাইন ও কালার থিম' : 'Accent Theme'}
              >
                <Palette size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="hidden lg:inline">{language === 'bn' ? 'থিম' : 'Theme'}</span>
              </button>

              {/* Dark Mode toggle */}
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer min-h-[36px] min-w-[36px]"
                title={darkMode ? (language === 'bn' ? 'লাইট মোড' : 'Light Mode') : (language === 'bn' ? 'ডার্ক মোড' : 'Dark Mode')}
              >
                {darkMode ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600 dark:text-slate-300" />}
              </button>

              {/* PWA In-App Install Button */}
              <PWAInstallButton />

              {/* Backup Hub Button — hidden for non-admin roles: the
                  backup_recovery tab is admin-only, so for them this was
                  a one-click dead end into a restricted wall. */}
              {isAdminTier && (
              <button
                onClick={() => setActiveTab('backup_recovery')}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-all cursor-pointer min-h-[36px]"
                title={language === 'bn' ? 'ডাটা সুরক্ষা ও ব্যাকআপ কেন্দ্র' : 'Data Safety & Backup Hub'}
              >
                <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">
                  {language === 'bn' ? 'ব্যাকআপ হাব' : 'Backup Hub'}
                </span>
              </button>
              )}

              {/* Cloud Status — display-only for non-admin roles (the chip
                  used to navigate to 'settings', which they cannot open);
                  admin-tier users keep the click-through. */}
              <div
                onClick={isAdminTier ? () => setActiveTab('settings') : undefined}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Cloud Status"
              >
                <Cloud size={13} className="text-indigo-600 dark:text-indigo-400" />
                {cloudStatus === 'connected' && (
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{language === 'bn' ? 'সংযুক্ত' : 'Connected'}</span>
                  </span>
                )}
                {cloudStatus === 'syncing' && (
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                    <RefreshCw size={11} className="animate-spin text-blue-500" />
                    <span>{language === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...'}</span>
                  </span>
                )}
                {cloudStatus === 'offline' && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                    <AlertCircle size={11} className="text-amber-500" />
                    <span>{language === 'bn' ? 'অফলাইন' : 'Offline'}</span>
                  </span>
                )}
                {cloudStatus === 'error' && (
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                    <AlertCircle size={11} className="text-rose-500" />
                    <span>{language === 'bn' ? 'অনুমতি ত্রুটি' : 'Auth Error'}</span>
                  </span>
                )}
              </div>

              {/* Language switcher */}
              <button 
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer min-h-[36px]"
                title="Switch Language"
              >
                <Languages size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="hidden xs:inline">{language === 'en' ? 'বাংলা' : 'English'}</span>
                <span className="xs:hidden font-bold">{language === 'en' ? 'বাং' : 'EN'}</span>
              </button>

              {/* User Profile & Logout */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {authUser && (
                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                      {(authUser.displayName || (authUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL ? 'M' : authUser.email) || 'U')[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                      {authUser.displayName || (authUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL ? 'Mehedi Hasan Sagor' : authUser.email?.split('@')[0])}
                    </span>
                  </div>
                )}

                <div className={`hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${
                  isSuperAdmin
                    ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-300'
                }`}>
                  <ShieldCheck size={13} className={isSuperAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'} />
                  <span>
                    {isSuperAdmin 
                      ? 'Super Admin'
                      : currentMember?.roleId === 'role_principal'
                      ? 'Principal'
                      : currentMember?.roleId === 'role_teacher'
                      ? 'Teacher'
                      : currentMember?.roleId === 'role_accountant'
                      ? 'Cashier'
                      : 'Admin'}
                  </span>
                </div>

                <button 
                  onClick={() => logoutAdmin()}
                  title={language === 'bn' ? 'লগআউট' : 'Logout'}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-semibold transition-colors cursor-pointer active:scale-95 min-h-[36px]"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:inline">{language === 'bn' ? 'লগআউট' : 'Exit'}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area with responsive bottom padding for mobile dock */}
        <main className="flex-1 overflow-auto p-3.5 sm:p-6 pb-24 md:pb-6 print:p-0 bg-slate-50/60 dark:bg-slate-950 transition-colors">
          {children}
        </main>

        {/* Modern Mobile Bottom Navigation Bar (Docked for Phone Screens with 44px min touch targets) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-1 py-1 print:hidden">
          <div className="flex items-center justify-around max-w-lg mx-auto">
            {/* 1. Dashboard */}
            <button
              onClick={() => handleTabClick('dashboard')}
              className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              style={activeTab === 'dashboard' ? { color: 'var(--color-brand, #4f46e5)' } : undefined}
            >
              <LayoutDashboard size={19} className={activeTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
              <span className="text-[10px] mt-0.5">{language === 'bn' ? 'ড্যাশবোর্ড' : 'Home'}</span>
            </button>

            {/* 2. Students */}
            <button
              onClick={() => handleTabClick('students')}
              className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'students'
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              style={activeTab === 'students' ? { color: 'var(--color-brand, #4f46e5)' } : undefined}
            >
              <Users size={19} className={activeTab === 'students' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
              <span className="text-[10px] mt-0.5">{language === 'bn' ? 'শিক্ষার্থী' : 'Students'}</span>
            </button>

            {/* 3. Attendance */}
            <button
              onClick={() => handleTabClick('attendance')}
              className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'attendance'
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              style={activeTab === 'attendance' ? { color: 'var(--color-brand, #4f46e5)' } : undefined}
            >
              <UserCheck size={19} className={activeTab === 'attendance' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
              <span className="text-[10px] mt-0.5">{language === 'bn' ? 'হাজিরা' : 'Attendance'}</span>
            </button>

            {/* 4. Results */}
            <button
              onClick={() => handleTabClick('results')}
              className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'results'
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              style={activeTab === 'results' ? { color: 'var(--color-brand, #4f46e5)' } : undefined}
            >
              <Award size={19} className={activeTab === 'results' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
              <span className="text-[10px] mt-0.5">{language === 'bn' ? 'ফলাফল' : 'Results'}</span>
            </button>

            {/* 5. Role-Adaptive Quick Slot: Finance for Admin/Accountant, Marks for Teacher, Notices for others */}
            {(isOwnerEmail || isAdmin || isSuperAdmin || hasPermission('finance.view') || hasPermission('finance.collect_fee')) ? (
              <button
                onClick={() => handleTabClick('finance')}
                className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'finance'
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                style={activeTab === 'finance' ? { color: 'var(--color-brand, #4f46e5)' } : undefined}
              >
                <Wallet size={19} className={activeTab === 'finance' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                <span className="text-[10px] mt-0.5">{language === 'bn' ? 'হিসাব' : 'Finance'}</span>
              </button>
            ) : (currentMember?.roleId === 'role_teacher' || currentMember?.role === 'Teacher') ? (
              <button
                onClick={() => handleTabClick('marks')}
                className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'marks'
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                style={activeTab === 'marks' ? { color: 'var(--color-brand, #4f46e5)' } : undefined}
              >
                <PenTool size={19} className={activeTab === 'marks' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                <span className="text-[10px] mt-0.5">{language === 'bn' ? 'নম্বর' : 'Marks'}</span>
              </button>
            ) : (
              <button
                onClick={() => handleTabClick('notices')}
                className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'notices'
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                style={activeTab === 'notices' ? { color: 'var(--color-brand, #4f46e5)' } : undefined}
              >
                <Megaphone size={19} className={activeTab === 'notices' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                <span className="text-[10px] mt-0.5">{language === 'bn' ? 'নোটিশ' : 'Notices'}</span>
              </button>
            )}

            {/* 6. More / All Modules Drawer (Opens MobileMoreSheet) */}
            <button
              onClick={() => setIsMobileMoreOpen(true)}
              className="min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer"
            >
              <Menu size={19} />
              <span className="text-[10px] mt-0.5">{language === 'bn' ? 'মেনু' : 'Menu'}</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile More Sheet */}
      <MobileMoreSheet
        isOpen={isMobileMoreOpen}
        onClose={() => setIsMobileMoreOpen(false)}
        onNavigateTab={handleTabClick}
        activeTab={activeTab}
      />

      {/* Modern Accent Theme Customizer Modal */}
      <ThemeSwitcherModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />

      {/* Reusable Admin Authentication Modal */}
      <AdminAuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />

      {/* Connectivity & Offline Mode Indicator */}
      <OfflineIndicator />
    </div>
  );
};

