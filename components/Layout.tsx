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
  useTheme();
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Sidebar is closed by default and opens on-demand when user clicks the menu button
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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

        {/* Navigation Menu - Clean, Direct Single-Level Menus (No Sub-menus) */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 custom-scrollbar">
          {/* Quick Module Search Input */}
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text"
              value={menuSearchQuery}
              onChange={(e) => setMenuSearchQuery(e.target.value)}
              placeholder={language === 'bn' ? 'মেনু খুঁজুন...' : 'Search menus...'}
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

          {mainMenuItems
            .filter(menu => isMenuVisible(menu))
            .filter(menu => {
              if (!menuSearchQuery.trim()) return true;
              const q = menuSearchQuery.toLowerCase().trim();
              return (
                menu.titleBn.toLowerCase().includes(q) ||
                menu.titleEn.toLowerCase().includes(q) ||
                menu.targetTab.toLowerCase().includes(q)
              );
            })
            .map((menu) => {
              const Icon = menu.icon;
              const isActive = activeTab === menu.targetTab || menu.associatedTabs.includes(activeTab);

              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => handleTabClick(menu.targetTab)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-indigo-400'
                    }`}>
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
                    <ChevronRight size={13} className={`transition-transform ${isActive ? 'text-white translate-x-0.5' : 'text-slate-500'}`} />
                  </div>
                </button>
              );
            })}

          {mainMenuItems.filter(menu => isMenuVisible(menu)).filter(menu => {
            if (!menuSearchQuery.trim()) return true;
            const q = menuSearchQuery.toLowerCase().trim();
            return (
              menu.titleBn.toLowerCase().includes(q) ||
              menu.titleEn.toLowerCase().includes(q) ||
              menu.targetTab.toLowerCase().includes(q)
            );
          }).length === 0 && (
            <div className="text-center py-6 text-slate-400 text-xs">
              {language === 'bn' ? 'কোনো মেনু পাওয়া যায়নি' : 'No matching menu found'}
            </div>
          )}
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

