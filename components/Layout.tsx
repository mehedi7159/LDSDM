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
  Trash2,
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
  CalendarDays,
  Palette
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

interface MainMenuItem {
  id: string;
  orderNumber: string;
  titleBn: string;
  titleEn: string;
  icon: any;
  targetTab: string;
  associatedTabs: string[];
  permissions?: string[];
  isAdminOnly?: boolean;
  isSuperAdminOnly?: boolean;
  badge?: string;
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
    pendingMembers = [],
    logoutAdmin 
  } = useApp();

  const isOwnerEmail = (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isOwner = isSuperAdmin || isOwnerEmail || (currentUser?.role === 'super_admin');
  // Multi-role: principal held as an additional role counts as principal.
  const isPrincipal = currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal' || (effectiveRoles || []).includes('principal');

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

  // Theme & Mobile Navigation Sheet states
  useTheme();
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Collapsible desktop rail: collapsed (icons only) by default; the
  // hamburger toggles it to expanded (icons + names). The old dark
  // slide-over drawer was removed entirely (3 Nov 2026) — its menus now
  // live in this rail, expanded in place.
  const [isRailExpanded, setIsRailExpanded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  // Collapse the expanded rail on ESC key press (replaces the old
  // drawer Esc-close; the drawer itself is gone).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsRailExpanded(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper function: Strictly check if a navigation item should be visible to the current user's role
  const isMenuVisible = (menu: MainMenuItem): boolean => {
    // 1. Super Admin items only visible to Super Admin / SUPER_ADMIN_EMAIL
    if (menu.isSuperAdminOnly) {
      return isSuperAdmin || isOwnerEmail;
    }

    // 2. Super Admin or Institution Admin has full access to all standard modules
    if (isSuperAdmin || isAdmin || isOwnerEmail || currentUser?.role === 'super_admin') {
      return true;
    }

    // 2b. Guardian-only sessions see exactly their portal, notice board, and settings
    if (isGuardianOnlySession) {
      return menu.targetTab === 'guardian_portal' || menu.targetTab === 'notice_board' || menu.targetTab === 'user_settings';
    }

    // 3. Admin-only items
    if (menu.isAdminOnly) {
      if (menu.permissions && menu.permissions.length > 0) {
        return menu.permissions.some(p => hasPermission(p as any));
      }
      return false;
    }

    // 4. Role granular permissions check
    if (menu.permissions && menu.permissions.length > 0) {
      return menu.permissions.some(p => hasPermission(p as any));
    }

    // 5. Non-admin role restrictions
    const isPrincipalUser = currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal' || userRole === 'principal' || (effectiveRoles || []).includes('principal');
    if (!isAdmin && !isSuperAdmin && !isOwnerEmail && !isPrincipalUser) {
      if (menu.targetTab === 'settings') return false;
    }

    return true;
  };

  // Phase 1 live notice: pending-applicant count for the HR menu badge.
  const pendingHrCount = (pendingMembers || []).length;

  // Single-level clean direct menus (No sub-menus)
  const mainMenuItems: MainMenuItem[] = [
    {
      id: 'dashboard',
      orderNumber: '১',
      titleBn: homeTab === 'dashboard' ? 'ড্যাশবোর্ড' : 'হোম',
      titleEn: homeTab === 'dashboard' ? 'Dashboard' : 'Home',
      icon: homeTab === 'dashboard' ? LayoutDashboard : Home,
      targetTab: homeTab,
      associatedTabs: ['dashboard']
    },
    {
      id: 'students',
      orderNumber: '২',
      titleBn: 'শিক্ষার্থী ব্যবস্থাপনা',
      titleEn: 'Student Management',
      icon: Users,
      targetTab: 'students',
      associatedTabs: [
        'students', 'student_admission', 'admission_applications',
        'class_wise_students', 'student_profile', 'guardian_info',
        'promotion', 'student_tc', 'former_students',
        'student_id_cards', 'student_reports'
      ],
      permissions: ['students.view', 'students.create', 'students.edit']
    },
    {
      id: 'academic',
      orderNumber: '৩',
      titleBn: 'একাডেমিক ব্যবস্থাপনা',
      titleEn: 'Academic Management',
      icon: BookOpen,
      targetTab: 'subjects',
      associatedTabs: [
        'subjects', 'class_section_setup', 'teacher_assignment',
        'class_routine', 'syllabus_planner', 'academic_calendar',
        'academic_reports'
      ],
      permissions: ['subjects.view', 'subjectAssignments.view', 'academic.view', 'classes.view']
    },
    {
      id: 'attendance',
      orderNumber: '৪',
      titleBn: 'উপস্থিতি ব্যবস্থাপনা',
      titleEn: 'Attendance Management',
      icon: UserCheck,
      targetTab: 'attendance',
      associatedTabs: [
        'attendance', 'staff_attendance', 'absent_students',
        'monthly_attendance_sheet', 'sync_exam_attendance',
        'attendance_reports'
      ],
      permissions: ['attendance.view', 'attendance.create', 'attendance.edit']
    },
    {
      id: 'finance',
      orderNumber: '৫',
      titleBn: 'হিসাব ও ফি ব্যবস্থাপনা',
      titleEn: 'Finance & Accounts',
      icon: Wallet,
      targetTab: 'finance',
      associatedTabs: ['finance', 'fee_structure', 'finance_reports', 'islamic_welfare'],
      permissions: ['finance.view', 'fees.view', 'payments.view']
    },
    {
      id: 'examination',
      orderNumber: '৬',
      titleBn: 'পরীক্ষা ও ফলাফল',
      titleEn: 'Exams & Results',
      icon: Award,
      targetTab: 'results',
      associatedTabs: [
        'results', 'exam_settings', 'marks', 'blank_marksheet',
        'tabulation_sheet', 'web_results', 'result_sms', 'exam_analytics'
      ],
      permissions: ['marks.view', 'marks.create', 'reports.view']
    },
    {
      id: 'staff',
      orderNumber: '৭',
      titleBn: 'শিক্ষক ও কর্মচারী',
      titleEn: 'Staff & HR Management',
      icon: Briefcase,
      targetTab: 'user_roles',
      associatedTabs: [
        'user_roles', 'staff_roles', 'staff_assignments',
        'staff_payroll', 'staff_leaves', 'staff_id_cards',
        'staff_analytics'
      ],
      permissions: ['roles.view', 'users.view', 'teachers.view'],
      badge: pendingHrCount > 0 ? `${pendingHrCount}` : undefined
    },
    {
      id: 'notices',
      orderNumber: '৮',
      titleBn: 'নোটিশ ও রিপোর্ট',
      titleEn: 'Notices & Reports',
      icon: Megaphone,
      targetTab: 'notice_board',
      associatedTabs: ['notice_board', 'admin_reports']
    },
    {
      id: 'settings',
      orderNumber: '৯',
      titleBn: 'সেটিংস ও সিস্টেম',
      titleEn: 'Settings & System',
      icon: Settings,
      targetTab: 'settings',
      associatedTabs: [
        'settings', 'branding_settings', 'backup_recovery',
        'recycle_bin', 'superadmin_audit', 'system_diagnostics'
      ],
      isAdminOnly: true,
      permissions: ['institution.settings.view']
    },
    {
      id: 'portals',
      orderNumber: '১০',
      titleBn: 'পোর্টাল ও সেবা',
      titleEn: 'Portals & Services',
      icon: Globe,
      targetTab: 'guardian_portal',
      associatedTabs: [
        'guardian_portal', 'online_admissions', 'public_web_results',
        'sms_gateway', 'boarding_mess'
      ]
    },
    {
      id: 'user_settings',
      orderNumber: '⚙️',
      titleBn: 'আমার সেটিংস',
      titleEn: 'My Settings',
      icon: Sliders,
      targetTab: 'user_settings',
      associatedTabs: ['user_settings']
    }
  ];

  // Rail menu list: the same visibility gate and the same search filter
  // the removed drawer used, computed once and reused below.
  const visibleMenus = mainMenuItems
    .filter(menu => isMenuVisible(menu))
    .filter(menu => {
      if (!menuSearchQuery.trim()) return true;
      const q = menuSearchQuery.toLowerCase().trim();
      return (
        menu.titleBn.toLowerCase().includes(q) ||
        menu.titleEn.toLowerCase().includes(q) ||
        menu.targetTab.toLowerCase().includes(q)
      );
    });

  // Rail state is deliberately left untouched on navigation: a persistent
  // sidebar stays expanded until the user collapses it (the old drawer
  // auto-closed because it was an overlay; the rail is not).
  const handleTabClick = (itemId: string) => {
    setActiveTab(itemId);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans relative">
      {/* Collapsible Desktop Sidebar Rail (md+ only): collapsed = icons only
          (default), expanded = icons + names, grown in place — the content
          area narrows accordingly, no overlay, no dark drawer. Every menu
          group the removed drawer showed lives here, in drawer order, with
          the drawer's targets, visibility gate and search filter. */}
      <aside className={`hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 shrink-0 z-20 justify-between py-3 select-none overflow-hidden transition-[width] duration-300 ease-out ${isRailExpanded ? 'w-72' : 'w-16'}`}>
        {/* Top: brand + menus */}
        <div className={`flex flex-col gap-2.5 w-full flex-1 min-h-0 ${isRailExpanded ? '' : 'items-center'}`}>
          {/* Institution Brand (home) */}
          <div className={`w-full ${isRailExpanded ? 'px-3' : 'flex justify-center'}`}>
            <button
              type="button"
              onClick={() => handleTabClick(homeTab)}
              className={`flex items-center gap-2.5 rounded-2xl text-white shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer ${
                isRailExpanded ? 'w-full px-3 py-2.5 justify-start' : 'w-10 h-10 justify-center'
              }`}
              title={schoolProfile.nameBn || schoolProfile.name}
              style={{ backgroundColor: 'var(--color-brand, #4f46e5)' }}
            >
              <GraduationCap size={20} className="shrink-0" />
              {isRailExpanded && (
                <span className="font-bold text-sm truncate text-left">
                  {schoolProfile.nameBn || schoolProfile.name}
                </span>
              )}
            </button>
          </div>

          <div className={`h-px bg-slate-200 dark:bg-slate-800 ${isRailExpanded ? 'mx-3' : 'w-8'}`} />

          {/* Menu Search (expanded state only — same filter as the old drawer) */}
          {isRailExpanded && (
            <div className="relative px-2 w-full">
              <Search size={14} className="absolute left-5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                placeholder={language === 'bn' ? 'মেনু খুঁজুন...' : 'Search menus...'}
                className="w-full pl-8 pr-7 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand-ring)] transition-all"
              />
              {menuSearchQuery && (
                <button
                  onClick={() => setMenuSearchQuery('')}
                  className="absolute right-5 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Menu list: drawer order, drawer targets, drawer visibility gate */}
          <div className={`flex-1 overflow-y-auto w-full custom-scrollbar ${isRailExpanded ? 'px-2 space-y-1' : 'px-2 flex flex-col items-center gap-1.5'}`}>
            {visibleMenus.map((menu) => {
              const Icon = menu.icon;
              const isActive = activeTab === menu.targetTab || menu.associatedTabs.includes(activeTab);
              if (!isRailExpanded) {
                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => handleTabClick(menu.targetTab)}
                    title={language === 'bn' ? menu.titleBn : menu.titleEn}
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                      isActive
                        ? 'font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    style={isActive ? { color: 'var(--color-brand, #4f46e5)', backgroundColor: 'var(--color-brand-light)' } : undefined}
                  >
                    <Icon size={18} className={isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                        style={{ backgroundColor: 'var(--color-brand, #4f46e5)' }}
                      />
                    )}
                    {menu.badge && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                        {menu.badge}
                      </span>
                    )}
                  </button>
                );
              }
              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => handleTabClick(menu.targetTab)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'text-white font-bold shadow-sm'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  style={isActive ? { backgroundColor: 'var(--color-brand, #4f46e5)' } : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20 text-white' : ''}`}
                      style={isActive ? undefined : { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand, #4f46e5)' }}
                    >
                      <Icon size={15} />
                    </div>
                    <span className="truncate">
                      {menu.orderNumber ? `${menu.orderNumber}. ` : ''}
                      {language === 'bn' ? menu.titleBn : menu.titleEn}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {menu.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                        {menu.badge}
                      </span>
                    )}
                    <ChevronRight size={13} className={isActive ? 'text-white translate-x-0.5' : 'text-slate-400'} />
                  </div>
                </button>
              );
            })}

            {visibleMenus.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                {language === 'bn' ? 'কোনো মেনু পাওয়া যায়নি' : 'No matching menu found'}
              </div>
            )}
          </div>
        </div>

        {/* Bottom tools: rail toggle (hamburger) + theme switcher */}
        <div className={`w-full pt-2 border-t border-slate-200/80 dark:border-slate-800 ${isRailExpanded ? 'flex flex-row items-center gap-2 px-3' : 'flex flex-col items-center gap-2 px-2'}`}>
          {/* Hamburger: toggles icons-only <-> icons + names */}
          <button
            type="button"
            onClick={() => setIsRailExpanded(v => !v)}
            title={isRailExpanded
              ? (language === 'bn' ? 'শুধু আইকন দেখান' : 'Show icons only')
              : (language === 'bn' ? 'মেনু নামসহ দেখান' : 'Show menu names')}
            className="w-10 h-10 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            {isRailExpanded ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={() => setIsThemeModalOpen(true)}
            title={language === 'bn' ? 'কালার থিম কাস্টমাইজ' : 'Accent Theme'}
            className="w-10 h-10 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <Palette size={18} />
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
                onClick={() => {
                  // Desktop: toggle the collapsible rail. Phone widths
                  // (Layout's admin/owner path): the rail is hidden, so
                  // open the mobile More sheet instead — the dark drawer
                  // this replaced is gone.
                  if (typeof window !== 'undefined' && window.innerWidth < 768) setIsMobileMoreOpen(true);
                  else setIsRailExpanded(v => !v);
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                title="Open Navigation Menu"
              >
                <Menu size={16} className="text-[var(--color-brand)]" />
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
                <Palette size={14} className="text-[var(--color-brand)] shrink-0" />
                <span className="hidden lg:inline">{language === 'bn' ? 'থিম' : 'Theme'}</span>
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
                <Cloud size={13} className="text-[var(--color-brand)]" />
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
                <Languages size={13} className="text-[var(--color-brand)] shrink-0" />
                <span className="hidden xs:inline">{language === 'en' ? 'বাংলা' : 'English'}</span>
                <span className="xs:hidden font-bold">{language === 'en' ? 'বাং' : 'EN'}</span>
              </button>

              {/* User Profile & Logout */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {authUser && (
                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-[var(--color-brand)] text-white font-bold flex items-center justify-center text-[11px] shrink-0">
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

