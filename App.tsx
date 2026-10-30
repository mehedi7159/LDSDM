import { SUPER_ADMIN_EMAIL } from './services/appConfig';
import { normalizeRoleKey, roleHomeTab } from './services/roleResolution';
import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { loadUserPrefs, applyPrefPreview } from './services/userPreferences';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { PwaUpdatePrompt } from './components/ui/PwaUpdatePrompt';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { RecycleBinPage } from './components/RecycleBinPage';
import { AccessRestrictedView } from './components/AccessRestrictedView';
import { Button } from './components/ui/Button';
import { Download, Loader2, LogOut, Smartphone } from 'lucide-react';
import { VerifiedResultModal } from './components/VerifiedResultModal';
import { LocalDataRecoveryModal } from './components/LocalDataRecoveryModal';
import { AuthPage } from './components/AuthPage';
import { LandingView } from './components/LandingView';
import { PendingApprovalView } from './components/PendingApprovalView';
import { StudentProfileView } from './components/StudentProfileView';
import { SkeletonStatCard, SkeletonTable } from './components/ui/ShimmerSkeleton';

// ---------------------------------------------------------------------------
// Phase 5 — route-level code splitting.
// Heavy tab modules load on demand (the first time their tab is opened)
// instead of inflating the initial bundle. Kept eager by design: the auth
// flow, layout/sidebar, Dashboard (landing tab), AppContext, and the public
// portal path (LandingView / AuthPage / StudentProfileView /
// VerifiedResultModal) so logged-out portal behaviour is byte-identical.
// ---------------------------------------------------------------------------
const StudentManager = lazyWithRetry(() => import('./components/StudentManager').then(m => ({ default: m.StudentManager })));
const FinanceManager = lazyWithRetry(() => import('./components/FinanceManager').then(m => ({ default: m.FinanceManager })));
const AcademicManager = lazyWithRetry(() => import('./components/academic/AcademicManager').then(m => ({ default: m.AcademicManager })));
const AttendanceManager = lazyWithRetry(() => import('./components/attendance/AttendanceManager').then(m => ({ default: m.AttendanceManager })));
const ExamResultsManager = lazyWithRetry(() => import('./components/examination/ExamResultsManager').then(m => ({ default: m.ExamResultsManager })));
const StaffManager = lazyWithRetry(() => import('./components/staff/StaffManager').then(m => ({ default: m.StaffManager })));
const ReportsSettingsManager = lazyWithRetry(() => import('./components/settings/ReportsSettingsManager').then(m => ({ default: m.ReportsSettingsManager })));
const PortalsServicesManager = lazyWithRetry(() => import('./components/portals/PortalsServicesManager').then(m => ({ default: m.PortalsServicesManager })));
const GuardianPortal = lazyWithRetry(() => import('./components/GuardianPortal').then(m => ({ default: m.GuardianPortal })));
const SpecializedServicesManager = lazyWithRetry(() => import('./components/services/SpecializedServicesManager').then(m => ({ default: m.SpecializedServicesManager })));
const InstitutionalOperationsManager = lazyWithRetry(() => import('./components/operations/InstitutionalOperationsManager').then(m => ({ default: m.InstitutionalOperationsManager })));
const MasterPrincipalAiAdvisor = lazyWithRetry(() => import('./components/ai/MasterPrincipalAiAdvisor').then(m => ({ default: m.MasterPrincipalAiAdvisor })));
const StudentReportView = lazyWithRetry(() => import('./components/StudentReportView').then(m => ({ default: m.StudentReportView })));
const StudentIDCardGenerator = lazyWithRetry(() => import('./components/StudentIDCardGenerator').then(m => ({ default: m.StudentIDCardGenerator })));
const StaffMobileApp = lazyWithRetry(() => import('./components/StaffMobileApp').then(m => ({ default: m.StaffMobileApp })));
const SettingsPage = lazyWithRetry(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Suspense fallback shown only while a lazy tab module is downloading.
const TabLoadingFallback = () => (
  <div className="space-y-4 p-1">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
    </div>
    <SkeletonTable rows={5} />
  </div>
);

// Wrapper component to handle tab logic cleanly inside context
const AppContent = () => {
  const { 
    exams, 
    classes, 
    t, 
    language, 
    schoolProfile, 
    isAdmin, 
    isSuperAdmin,
    hasPermission,
    students, 
    subjects, 
    marks, 
    authUser,
    currentUser,
    userRole,
    effectiveRoles,
    authClaims,
    authRole,
    currentMember,
    logoutAdmin,
    isRecoveryModalOpen, 
    setIsRecoveryModalOpen,
    isAuthReady,
    activeTab,
    setActiveTab
  } = useApp();
  
  // User is authenticated if Firebase authUser OR role currentUser OR currentMember exists
  const isAuthenticated = !!(authUser || currentUser || currentMember);

  // Debounced verification & redirection to prevent screen flashing/looping
  const debounceRedirectRef = useRef<NodeJS.Timeout | null>(null);
  const [bypassAuthLoading, setBypassAuthLoading] = useState(false);
  const [unauthScreen, setUnauthScreen] = useState<'landing' | 'results' | 'login' | 'student_profile'>('landing');

  // Determine if current user is one of the dedicated non-admin roles (Teacher, Cashier, Parent, Staff)
  const isNonAdminRole = useMemo(() => {
    if (isSuperAdmin || isAdmin || currentUser?.role === 'super_admin' || currentUser?.role === 'principal') return false;
    if (currentMember?.roleId === 'role_principal' || userRole === 'principal') return false;
    const roleId = currentMember?.roleId || authRole || currentUser?.role || '';
    return roleId === 'role_teacher' || roleId === 'teacher' || 
           roleId === 'role_accountant' || roleId === 'accountant' || 
           roleId === 'role_guardian' || roleId === 'guardian' || roleId === 'parent' ||
           roleId === 'role_staff' || roleId === 'staff';
  }, [isSuperAdmin, isAdmin, currentMember, authRole, currentUser, userRole]);

  // Phase 1b: principal / super_admin get a dedicated mobile home at
  // phone widths (StaffMobileApp) while desktop keeps Layout+Dashboard
  // exactly. Keyed on the same role signals the gate above uses. Plain
  // 'admin' users are NOT included — they keep Layout at all widths.
  const isPrincipalMobile = useMemo(() => {
    if (isSuperAdmin || currentUser?.role === 'super_admin') return true;
    if (currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal' || userRole === 'principal') return true;
    return (effectiveRoles || []).includes('principal');
  }, [isSuperAdmin, currentUser, currentMember, userRole, effectiveRoles]);

  // Persisted display prefs (text size / corner) apply on boot so a
  // saved Settings choice survives reloads on every page that reads them.
  useEffect(() => {
    applyPrefPreview(loadUserPrefs());
  }, []);

  useEffect(() => {
    // Fail-safe: Automatically dismiss loading screen after 1.2s max if auth is taking time
    const timer = setTimeout(() => {
      setBypassAuthLoading(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Helper function to resolve tab authorization
  const isTabAllowedForUser = (tab: string): boolean => {
    const isOwnerAdmin = isSuperAdmin || isAdmin || currentUser?.role === 'super_admin' || (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    if (isOwnerAdmin) return true;

    // Principal has administrative access to analytical and management tabs.
    // Multi-role: principal held as an ADDITIONAL role counts too (union).
    if (currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal' || userRole === 'principal' || (effectiveRoles || []).includes('principal')) {
      if (tab === 'backup_recovery' || tab === 'superadmin_audit' || tab === 'recycle_bin') return false;
      return true;
    }

    // Guardian-ONLY sessions: the guardian experience is the
    // self-service portal (their OWN children only, resolved by
    // services/guardianScope.ts) plus the shared notice board. Every
    // other tab — the all-student managers, reports, finance and the
    // public lookup surfaces included — is closed to them at this
    // gate, no matter which broad permission (students.view /
    // fees.view / marks.view …) the guardian template carries. Those
    // permissions still drive the portal's own child-scoped views;
    // this block changes nothing for any other role (a user holding
    // guardian alongside another role keeps the union behaviour).
    // 'dashboard' stays allowed so the debounced home redirect moves
    // them to guardian_portal exactly as before.
    const isGuardianOnlySession = (effectiveRoles || []).includes('guardian')
      && (effectiveRoles || []).every(r => r === 'guardian');
    if (isGuardianOnlySession) {
      return tab === 'guardian_portal' || tab === 'notice_board' || tab === 'dashboard' || tab === 'user_settings';
    }

    // Public / universal tabs.
    // NOTE: 'academic_reports' is deliberately NOT universal — its render
    // guard requires reports.view || subjects.view, so a guardian (who
    // has neither) used to pass this gate and hit a restricted wall. It
    // has its own case below mirroring the render guard.
    if (tab === 'dashboard' || tab === 'web_results' || tab === 'student_profile' || tab === 'notice_board' || tab === 'user_settings') {
      return true;
    }

    // Role-specific permission gates
    switch (tab) {
      case 'finance':
        return isAdmin || hasPermission('finance.view') || hasPermission('fees.view') || hasPermission('payments.view') || currentUser?.role === 'accountant';
      case 'finance_reports':
        return isAdmin || hasPermission('finance.view') || hasPermission('reports.view') || currentUser?.role === 'accountant';
      case 'students':
      case 'student_admission':
      case 'admission_applications':
      case 'class_wise_students':
      case 'guardian_info':
      case 'student_tc':
      case 'former_students':
        return isAdmin || hasPermission('students.view') || hasPermission('students.create');
      case 'promotion':
        return isAdmin || hasPermission('students.edit') || hasPermission('students.create');
      case 'student_reports':
        return isAdmin || hasPermission('students.view') || hasPermission('reports.view');
      case 'subjects':
      case 'class_routine':
        return isAdmin || hasPermission('subjects.view') || hasPermission('subjectAssignments.view') || currentUser?.role === 'teacher';
      // The cases below mirror their renderContent guards exactly. They
      // used to share the subjects case above, which let roles PASS this
      // gate and then hit the render-level restricted wall (e.g. a
      // teacher opening syllabus_planner), or FAIL it despite the menu
      // and render both allowing them (office staff opening
      // class_section_setup via classes.view).
      case 'class_section_setup':
        return isAdmin || hasPermission('classes.view') || hasPermission('teachers.view');
      case 'teacher_assignment':
        return isAdmin || hasPermission('subjectAssignments.view') || hasPermission('teachers.view');
      case 'syllabus_planner':
      case 'academic_calendar':
        return isAdmin || hasPermission('academic.view');
      case 'academic_reports':
        return isAdmin || hasPermission('reports.view') || hasPermission('subjects.view');
      case 'marks':
        return isAdmin || hasPermission('marks.view') || hasPermission('marks.create') || hasPermission('marks.edit') || currentUser?.role === 'teacher';
      case 'exam_settings':
        return isAdmin || hasPermission('institution.settings.view');
      case 'student_id_cards':
        return isAdmin || hasPermission('students.view');
      case 'attendance':
      case 'staff_attendance':
      case 'absent_students':
      case 'monthly_attendance_sheet':
      case 'sync_exam_attendance':
        return isAdmin || hasPermission('attendance.view') || hasPermission('attendance.create') || hasPermission('attendance.edit') || currentUser?.role === 'teacher';
      case 'attendance_reports':
        return isAdmin || hasPermission('attendance.view') || hasPermission('reports.view') || currentUser?.role === 'teacher';
      case 'fee_structure':
        return isAdmin || hasPermission('finance.view') || hasPermission('fees.view') || currentUser?.role === 'accountant';
      // Staff/HR tabs — split per tab to mirror each renderContent guard
      // exactly. The old lumped case (roles.view || users.view) bounced
      // roles whose menu item was visible and whose module would have
      // rendered: teacher → staff_assignments/staff_analytics,
      // accountant → staff_payroll.
      case 'user_roles':
        return isAdmin || hasPermission('roles.view') || hasPermission('users.view') || hasPermission('teachers.view') || currentUser?.role === 'principal';
      case 'staff_roles':
        return isAdmin || hasPermission('roles.view') || hasPermission('users.view') || currentUser?.role === 'principal';
      case 'staff_assignments':
        return isAdmin || hasPermission('subjects.view') || hasPermission('teachers.view');
      case 'staff_payroll':
        return isAdmin || hasPermission('finance.view') || hasPermission('fees.view');
      case 'staff_leaves':
      case 'staff_id_cards':
        return isAdmin || hasPermission('users.view');
      case 'staff_analytics':
        return isAdmin || hasPermission('reports.view');
      case 'settings':
      case 'branding_settings':
        return isAdmin || hasPermission('institution.settings.view');
      case 'backup_recovery':
        return isAdmin;
      case 'recycle_bin':
        return isAdmin;
      case 'superadmin_audit':
        return isSuperAdmin;
      case 'admin_reports':
        return isAdmin || hasPermission('reports.view');
      case 'system_diagnostics':
        return isAdmin || isSuperAdmin;
      case 'results':
      case 'blank_marksheet':
      case 'tabulation_sheet':
      case 'result_sms':
      case 'exam_analytics':
        return isAdmin || hasPermission('marks.view') || hasPermission('marks.create') || hasPermission('reports.view') || currentUser?.role === 'teacher';
      case 'guardian_portal':
      case 'online_admissions':
      case 'public_web_results':
        return true;
      case 'sms_gateway':
        // Layout shows this to the accountant as well (primary or
        // additional role); the module renders unconditionally, so the
        // gate now matches the menu.
        return isAdmin || currentUser?.role === 'principal' || currentUser?.role === 'teacher' || currentUser?.role === 'accountant' || (effectiveRoles || []).includes('accountant');
      case 'boarding_mess':
        return isAdmin || currentUser?.role === 'principal' || currentUser?.role === 'teacher' || currentUser?.role === 'accountant' || (effectiveRoles || []).includes('accountant');
      case 'islamic_welfare':
        return isAdmin || currentUser?.role === 'principal' || currentUser?.role === 'accountant';
      case 'book_bank':
      case 'book_issues':
      case 'transport_fleet':
      case 'mahfil_events':
      case 'activities_clubs':
      case 'fixed_assets':
      case 'store_inventory':
      case 'house_system':
      case 'fuzala_alumni':
      case 'health_medical':
        return true;
      case 'ai_principal_advisor':
        return isOwnerAdmin || isSuperAdmin || isAdmin || currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal';
      default:
        return true;
    }
  };

  // Desktop home tab for non-admin roles. The principal's Dashboard is
  // gate-allowed for everyone, so without an explicit home rule a
  // teacher/accountant/staff/guardian session lands on it — institution
  // totals, report doors and operational to-dos that are not their home.
  // Each non-admin role gets its primary work module instead
  // (roleHomeTab). Admin-tier users keep 'dashboard' exactly.
  // MOBILE IS UNTOUCHED: the redirect below only fires at desktop width;
  // StaffMobileApp owns the mobile experience.
  const primaryRoleKey = normalizeRoleKey(currentUser?.role)
    || normalizeRoleKey(currentMember?.roleId)
    || normalizeRoleKey(authRole)
    || normalizeRoleKey(userRole)
    || normalizeRoleKey((effectiveRoles || [])[0]);
  // A user holding principal as an ADDITIONAL role keeps the Dashboard:
  // the tab gate already treats them as principal throughout.
  const homeTab = (isNonAdminRole && !(effectiveRoles || []).includes('principal'))
    ? roleHomeTab(primaryRoleKey)
    : 'dashboard';
  const isDesktopWidth = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

  // Debounced verification hook to avoid transient screen flashing and redirection loops
  useEffect(() => {
    // 1. While auth state is initializing or checking, NEVER redirect or evaluate tab permissions.
    // This stable state flag guarantees zero screen flashing during initial boot.
    if (!isAuthReady) {
      return;
    }

    // 2. If unauthenticated, no tab redirection is performed (AuthPage is rendered)
    if (!isAuthenticated) {
      return;
    }

    // 3. Clear any pending debounce timeout
    if (debounceRedirectRef.current) {
      clearTimeout(debounceRedirectRef.current);
    }

    // 4. Fast-path check: If immediately allowed, do nothing — EXCEPT a
    // non-admin role sitting on the principal's Dashboard at desktop
    // width, which belongs on its role home (see homeTab above).
    const isAllowed = isTabAllowedForUser(activeTab);
    const needsHomeRedirect = isNonAdminRole && activeTab === 'dashboard' && homeTab !== 'dashboard' && isDesktopWidth();
    if (isAllowed && !needsHomeRedirect) {
      return;
    }

    // 5. Debounced verification check (300ms stabilization window):
    // Prevents false-negative redirects while claims, roles, or member records are settling asynchronously
    debounceRedirectRef.current = setTimeout(() => {
      const stillAllowed = isTabAllowedForUser(activeTab);
      const stillNeedsHome = isNonAdminRole && activeTab === 'dashboard' && homeTab !== 'dashboard' && isDesktopWidth();
      if (!stillAllowed || stillNeedsHome) {
        // Non-admin desktop users go to their role home (when the home
        // itself passes the gate); everyone else keeps the historical
        // 'dashboard' fallback. On mobile the target stays 'dashboard'
        // so mobile behaviour is unchanged.
        const target = (isNonAdminRole && isDesktopWidth() && homeTab !== 'dashboard' && isTabAllowedForUser(homeTab))
          ? homeTab
          : 'dashboard';
        if (activeTab !== target) {
          console.warn(`[Navigation] Redirecting "${activeTab}" -> "${target}" for this role.`);
          setActiveTab(target);
        }
      }
    }, 300);

    return () => {
      if (debounceRedirectRef.current) {
        clearTimeout(debounceRedirectRef.current);
      }
    };
  }, [activeTab, authUser, authClaims, authRole, isAdmin, isSuperAdmin, currentMember, isAuthReady, isNonAdminRole, homeTab]);
  
  // States for Result switching
  const [resultMode, setResultMode] = useState<'individual' | 'class'>('individual');
  const [classViewConfig, setClassViewConfig] = useState({ classLevel: classes[0]?.name || '', examId: '' });

  // Verification modal for direct QR code scanning
  const [directVerifyData, setDirectVerifyData] = useState<{ student: any; exam: any } | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const verify = params.get('verify');
      const sid = params.get('sid');
      const eid = params.get('eid');

      if (verify && sid && students.length > 0 && exams.length > 0) {
        const student = students.find(s => s.id === sid || s.studentId === sid);
        const exam = eid ? exams.find(e => e.id === eid) : exams[0];
        if (student && exam) {
          setDirectVerifyData({ student, exam });
        }
      }
    } catch (e) {
      console.error('Error parsing verify params:', e);
    }
  }, [students, exams]);

  useEffect(() => {
      document.title = (schoolProfile.nameBn || schoolProfile.name || (language === 'bn' ? 'মাদ্রাসা' : 'Madrasah')) + ' - Madrasah Management System';
  }, [language, t, schoolProfile]);

  useEffect(() => {
    const root = document.documentElement;
    // Hind Siliguri and Noto fonts were purged system-wide: digits in Hind Siliguri
    // clipped vertically and were illegible. Anek Bangla is the clean, unclipped default.
    const sanitizeFont = (v?: string, fallback = 'Anek Bangla') =>
      !v || v === 'Hind Siliguri' || v === 'Noto Sans Bengali' || v === 'Noto Serif Bengali' ? fallback : v;
    const font = sanitizeFont(schoolProfile.banglaFont);
    const numFont = sanitizeFont(schoolProfile.banglaNumberFont);
    const uiFont = sanitizeFont(schoolProfile.uiFont);

    root.style.setProperty('--bangla-font', `'${font}', 'Anek Bangla', sans-serif`);
    root.style.setProperty('--bangla-num-font', `'${numFont}', 'Anek Bangla', sans-serif`);
    // On-screen UI font: Inter keeps Latin text; Bengali glyphs + Bengali
    // digits render in the chosen UI font (Anek Bangla by default, numbers never clip).
    root.style.setProperty('--ui-font', `'Inter', '${uiFont}', 'Anek Bangla', sans-serif`);
  }, [schoolProfile.banglaFont, schoolProfile.banglaNumberFont, schoolProfile.uiFont]);


  const renderContent = () => {
    const isOwnerAdmin = isSuperAdmin || (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    switch (activeTab) {
      case 'dashboard': 
        return <Dashboard />;
      case 'finance':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('finance.view') || hasPermission('fees.view') || hasPermission('payments.view')) 
          ? <FinanceManager initialTab="overview" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={t('finance')} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'finance_reports':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('finance.view') || hasPermission('reports.view')) 
          ? <FinanceManager initialTab="reports" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'আর্থিক রিপোর্ট' : 'Financial Reports'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'students': 
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.view') || hasPermission('students.create')) 
          ? <StudentManager initialSubTab="list" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={t('students')} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'student_admission':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.create') || hasPermission('students.view'))
          ? <StudentManager initialSubTab="admission" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'নতুন ভর্তি' : 'New Admission'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'admission_applications':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.view') || hasPermission('students.create'))
          ? <StudentManager initialSubTab="applications" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ভর্তি আবেদন' : 'Admission Applications'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'class_wise_students':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.view'))
          ? <StudentManager initialSubTab="classes" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'শ্রেণি ও শাখাভিত্তিক শিক্ষার্থী' : 'Class-wise Students'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'guardian_info':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.view'))
          ? <StudentManager initialSubTab="guardians" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'অভিভাবকের তথ্য' : 'Guardian Directory'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'promotion':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.edit') || hasPermission('students.create'))
          ? <StudentManager initialOpenPromotion={true} initialSubTab="promotion" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'শ্রেণি উত্তরণ (প্রমোশন)' : 'Class Promotion'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'student_tc':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.view') || hasPermission('students.edit'))
          ? <StudentManager initialSubTab="tc" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'শিক্ষার্থী ছাড়পত্র (TC)' : 'Transfer Certificate (TC)'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'former_students':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.view'))
          ? <StudentManager initialSubTab="former" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'সাবেক শিক্ষার্থী' : 'Former Students'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'student_reports':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.view') || hasPermission('reports.view')) 
          ? <StudentReportView /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'শিক্ষার্থী রিপোর্ট' : 'Student Reports'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'subjects': 
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('subjects.view') || hasPermission('subjectAssignments.view')) 
          ? <AcademicManager initialSubTab="curriculum" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={t('subjects')} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'class_section_setup':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('classes.view') || hasPermission('teachers.view'))
          ? <AcademicManager initialSubTab="classes" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'শ্রেণি ও শাখা সমন্বয়' : 'Classes & Sections'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'teacher_assignment':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('subjectAssignments.view') || hasPermission('teachers.view'))
          ? <AcademicManager initialSubTab="teachers" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'শিক্ষক ও বিষয় বণ্টন' : 'Teacher-Subject Assignment'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'class_routine':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('academic.view') || hasPermission('subjects.view'))
          ? <AcademicManager initialSubTab="routine" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ক্লাস রুটিন ও সময়সূচি' : 'Class Routine'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'syllabus_planner':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('academic.view'))
          ? <AcademicManager initialSubTab="syllabus" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'সিলেবাস ও পাঠ পরিকল্পনা' : 'Syllabus & Lesson Plan'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'academic_calendar':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('academic.view'))
          ? <AcademicManager initialSubTab="calendar" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'একাডেমিক ক্যালেন্ডার ও ছুটি' : 'Academic Calendar'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'academic_reports':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('reports.view') || hasPermission('subjects.view'))
          ? <AcademicManager initialSubTab="analytics" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'একাডেমিক অ্যানালিটিক্স' : 'Academic Analytics'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'marks': 
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('marks.view') || hasPermission('marks.create') || hasPermission('marks.edit')) 
          ? <ExamResultsManager initialSubTab="marks" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={t('marks')} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'exam_settings':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('institution.settings.view')) 
          ? <ExamResultsManager initialSubTab="setup" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'পরীক্ষা ও টার্ম ব্যবস্থাপনা' : 'Exams & Terms Management'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'blank_marksheet':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('marks.view') || hasPermission('marks.create'))
          ? <ExamResultsManager initialSubTab="blank_sheet" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ব্লাঙ্ক মার্কশিট প্রিন্ট' : 'Blank Marksheet Print'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'tabulation_sheet':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('marks.view') || hasPermission('reports.view'))
          ? <ExamResultsManager initialSubTab="tabulation" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'মেধাতালিকা ও ট্যাবুলেশন শিট' : 'Merit Tabulation Sheet'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'result_sms':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('marks.view'))
          ? <ExamResultsManager initialSubTab="sms" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ফলাফল SMS অ্যালার্ট' : 'Result SMS Alert'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'exam_analytics':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('marks.view') || hasPermission('reports.view'))
          ? <ExamResultsManager initialSubTab="analytics" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ফলাফল অ্যানালিটিক্স' : 'Exam Analytics'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'web_results':
        return <ExamResultsManager initialSubTab="web_results" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'student_profile':
        return <StudentProfileView onBack={() => setActiveTab('dashboard')} />;
      case 'notice_board':
        return <ReportsSettingsManager initialSubTab="notices" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'student_id_cards':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('students.view')) 
          ? <StudentIDCardGenerator /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'আইডি কার্ড ও প্রশংসাপত্র' : 'ID Cards & Certificates'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'attendance': 
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('attendance.view') || hasPermission('attendance.create') || hasPermission('attendance.edit')) 
          ? <AttendanceManager initialSubTab="students" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={t('attendance')} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'staff_attendance':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('attendance.view') || hasPermission('attendance.create'))
          ? <AttendanceManager initialSubTab="staff" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'শিক্ষক-কর্মচারীর উপস্থিতি' : 'Staff Attendance'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'absent_students':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('attendance.view'))
          ? <AttendanceManager initialSubTab="absentees" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'অনুপস্থিত তালিকা ও SMS' : 'Absentees & SMS'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'monthly_attendance_sheet':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('attendance.view'))
          ? <AttendanceManager initialSubTab="register" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'মাসিক হাজিরা শিট ও রেজিস্টার' : 'Monthly Attendance Sheet'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'sync_exam_attendance':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('attendance.edit') || hasPermission('marks.create'))
          ? <AttendanceManager initialSubTab="sync" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'পরীক্ষার মার্কশিটে সিঙ্ক' : 'Sync to Marksheet'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'attendance_reports':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('attendance.view') || hasPermission('reports.view')) 
          ? <AttendanceManager initialSubTab="reports" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'হাজিরা রিপোর্ট' : 'Attendance Reports'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'fee_structure':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('finance.view') || hasPermission('fees.view')) 
          ? <FinanceManager initialTab="fee-settings" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ফি কাঠামো ও রেট চার্ট' : 'Fee Structure & Rates'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'user_roles':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('roles.view') || hasPermission('users.view') || hasPermission('teachers.view')) 
          ? <StaffManager initialSubTab="directory" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'শিক্ষক ও কর্মী ডিরেক্টরি' : 'Staff Directory'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'staff_roles':
        // Phase 4: the old roles tab is merged into the directory —
        // this route now lands on the single "শিক্ষক, কর্মী ও অ্যাকাউন্ট" tab.
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('roles.view') || hasPermission('users.view'))
          ? <StaffManager initialSubTab="directory" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'শিক্ষক, কর্মী ও অ্যাকাউন্ট' : 'Staff & Accounts'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'staff_assignments':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('subjects.view') || hasPermission('teachers.view')) 
          ? <StaffManager initialSubTab="assignments" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'দায়িত্ব ও বিষয় বণ্টন' : 'Workload & Subjects'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'staff_payroll':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('finance.view') || hasPermission('fees.view')) 
          ? <StaffManager initialSubTab="payroll" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'বেতন ও মাসিক পে-রোল' : 'Payroll & Salary'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'staff_leaves':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('users.view')) 
          ? <StaffManager initialSubTab="leaves" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ছুটি ও ছুটির আবেদন' : 'Staff Leave Records'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'staff_id_cards':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('users.view')) 
          ? <StaffManager initialSubTab="id_cards" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'স্টাফ আইডি কার্ড ও প্রত্যয়ন' : 'Staff ID Cards & NOC'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'staff_analytics':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('reports.view')) 
          ? <StaffManager initialSubTab="analytics" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'জনবল অ্যানালিটিক্স ও রিপোর্ট' : 'HR Analytics & Census'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'settings': 
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('institution.settings.view')) 
          ? <ReportsSettingsManager initialSubTab="profile" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={t('settings')} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'branding_settings': 
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('institution.settings.view')) 
          ? <ReportsSettingsManager initialSubTab="branding" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'সিল ও ব্র্যান্ডিং সেটিংস' : 'Branding Settings'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'backup_recovery':
        return (isOwnerAdmin || isAdmin || isSuperAdmin) 
          ? <ReportsSettingsManager initialSubTab="backup" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ডাটা সুরক্ষা ও ব্যাকআপ কেন্দ্র' : 'Data Safety & Backup Hub'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'recycle_bin':
        return (isOwnerAdmin || isAdmin || isSuperAdmin)
          ? <RecycleBinPage />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'রিসাইকেল বিন' : 'Recycle Bin'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'superadmin_audit':
        return (isOwnerAdmin || isSuperAdmin) 
          ? <ReportsSettingsManager initialSubTab="audit" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName="Super Admin Security Audit" onGoToResults={() => setActiveTab('dashboard')} />;
      case 'admin_reports':
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('reports.view')) 
          ? <ReportsSettingsManager initialSubTab="admin_reports" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'প্রশাসনিক রিপোর্ট' : 'Admin Reports'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'system_diagnostics':
        return (isOwnerAdmin || isAdmin || isSuperAdmin)
          ? <ReportsSettingsManager initialSubTab="diagnostics" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'সিস্টেম ডায়াগনস্টিকস' : 'System Diagnostics'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'results': 
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('marks.view') || hasPermission('marks.create') || hasPermission('reports.view')) 
          ? <ExamResultsManager initialSubTab="cards" onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ফলাফল ও মার্কশিট' : 'Result Cards & Tabulation'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'guardian_portal': {
        // A guardian session (guardian role held, no admin-tier role)
        // gets the SELF-SERVICE portal — their own child(ren) only.
        // Staff/admin sessions keep the office's Portals & Services
        // manager (the all-student guardian directory preview is an
        // office tool; it was previously what guardians landed on,
        // which let them browse every student).
        const isGuardianSelfView = (effectiveRoles || []).includes('guardian')
          && !isAdmin && !isSuperAdmin && !isOwnerAdmin
          && !(effectiveRoles || []).includes('principal');
        return isGuardianSelfView
          ? <GuardianPortal />
          : <PortalsServicesManager initialSubTab="guardian_portal" onNavigateTab={(tab) => setActiveTab(tab)} />;
      }
      case 'online_admissions':
        return <PortalsServicesManager initialSubTab="online_admissions" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'public_web_results':
        return <PortalsServicesManager initialSubTab="web_results" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'sms_gateway':
        return <PortalsServicesManager initialSubTab="sms_gateway" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'boarding_mess':
        return <PortalsServicesManager initialSubTab="boarding_mess" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'islamic_welfare':
        return <PortalsServicesManager initialSubTab="islamic_welfare" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'book_bank':
        return <SpecializedServicesManager initialSubTab="book_bank" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'book_issues':
        return <SpecializedServicesManager initialSubTab="book_issues" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'transport_fleet':
        return <SpecializedServicesManager initialSubTab="transport_fleet" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'mahfil_events':
        return <SpecializedServicesManager initialSubTab="mahfil_events" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'activities_clubs':
        return <SpecializedServicesManager initialSubTab="activities_clubs" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'fixed_assets':
        return <InstitutionalOperationsManager initialSubTab="fixed_assets" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'store_inventory':
        return <InstitutionalOperationsManager initialSubTab="store_inventory" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'house_system':
        return <InstitutionalOperationsManager initialSubTab="house_system" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'fuzala_alumni':
        return <InstitutionalOperationsManager initialSubTab="fuzala_alumni" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'health_medical':
        return <InstitutionalOperationsManager initialSubTab="health_medical" onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'ai_principal_advisor':
        return (isOwnerAdmin || isSuperAdmin || isAdmin || currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal')
          ? <MasterPrincipalAiAdvisor onNavigateTab={(tab) => setActiveTab(tab)} />
          : <AccessRestrictedView moduleName={language === 'bn' ? 'মাস্টার প্রিন্সিপাল এআই' : 'Master AI Principal'} onGoToResults={() => setActiveTab('dashboard')} />;
      case 'user_settings':
        return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  // 1. If auth is still checking / initializing, display smooth branded loading screen with fail-safe bypass
  if (!isAuthReady && !bypassAuthLoading) {
    return (
      <div className={`min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4 ${language === 'bn' ? 'font-bangla' : ''}`}>
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/30 shadow-lg">
          <Loader2 className="animate-spin text-emerald-400" size={28} />
        </div>
        <p className="text-sm font-semibold text-slate-200 text-center">
          {schoolProfile.nameBn || schoolProfile.name || 'Madrasah Management System'}
        </p>
        <p className="text-xs text-slate-400 mt-1 text-center">
          {language === 'bn' ? 'অনুমোদন ও সেশন যাচাই করা হচ্ছে...' : 'Verifying authorization session...'}
        </p>
        <button
          onClick={() => setBypassAuthLoading(true)}
          className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 cursor-pointer transition-all flex items-center gap-1.5"
        >
          <span>{language === 'bn' ? 'অ্যাপে প্রবেশ করুন' : 'Enter App'}</span>
          <span>→</span>
        </button>
      </div>
    );
  }

  // 2. If not authenticated, show LandingView with 'View Results' and 'Admin Login'
  if (!isAuthenticated) {
    return (
      <div className={language === 'bn' ? 'font-bangla' : ''}>
        {unauthScreen === 'landing' && (
          <LandingView
            onViewResults={() => setUnauthScreen('results')}
            onAdminLogin={() => setUnauthScreen('login')}
            onStudentProfile={() => setUnauthScreen('student_profile')}
          />
        )}
        {unauthScreen === 'student_profile' && (
          <StudentProfileView
            onBack={() => setUnauthScreen('landing')}
          />
        )}
        {unauthScreen === 'results' && (
          <AuthPage
            initialView="results"
            onBack={() => setUnauthScreen('landing')}
            onStudentProfile={() => setUnauthScreen('student_profile')}
          />
        )}
        {unauthScreen === 'login' && (
          <AuthPage
            initialView="login"
            onBack={() => setUnauthScreen('landing')}
            onStudentProfile={() => setUnauthScreen('student_profile')}
          />
        )}
        {directVerifyData && (
          <VerifiedResultModal
            student={directVerifyData.student}
            exam={directVerifyData.exam}
            schoolProfile={schoolProfile}
            subjects={subjects}
            marks={marks}
            exams={exams}
            language={language}
            onClose={() => setDirectVerifyData(null)}
          />
        )}
      </div>
    );
  }

  // 2. If authenticated but account is pending approval, suspended, or inactive
  if ((currentMember?.status === 'pending' || currentMember?.status === 'suspended' || currentMember?.status === 'inactive') && !isSuperAdmin && !isAdmin) {
    return (
      <div className={language === 'bn' ? 'font-bangla' : ''}>
        <PendingApprovalView onLogout={() => logoutAdmin()} />
      </div>
    );
  }

  return (
    <div className={language === 'bn' ? 'font-bangla' : ''}>
      {isNonAdminRole || isPrincipalMobile ? (
        <>
          {/* Dedicated Native Mobile App View for Teacher, Cashier, Parent, Staff, Principal (phone widths only; desktop below is Layout) */}
          <div className="block md:hidden">
            <Suspense fallback={<TabLoadingFallback />}>
              <StaffMobileApp
                onLogout={() => logoutAdmin()}
                renderModuleContent={() => (
                  <Suspense fallback={<TabLoadingFallback />}>
                    {renderContent()}
                  </Suspense>
                )}
              />
            </Suspense>
          </div>
          {/* Standard Desktop View — mobile-only roles (teacher, accountant,
              staff, guardian) never see the system here: blank background +
              a kind message asking them to switch to mobile view instead. */}
          <div className="hidden md:block">
            {isNonAdminRole && !isPrincipalMobile ? (
              <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center p-6">
                <div className="w-full max-w-sm text-center">
                  <span className="mx-auto w-20 h-20 rounded-full brand-soft flex items-center justify-center">
                    <Smartphone size={36} className="brand-text" />
                  </span>
                  <h1 className="mt-5 text-lg font-black text-[#1e293b]">
                    {language === 'bn' ? 'শুধু মোবাইলে ব্যবহার করা যায়' : 'Mobile only'}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[#5b6478]">
                    {language === 'bn'
                      ? 'এই অ্যাকাউন্টটি শুধু মোবাইল ফোন থেকে ব্যবহার করা যায়। অনুগ্রহ করে আপনার মোবাইল ফোন থেকে খুলুন।'
                      : 'This account can only be used from a mobile phone. Please open it on your phone.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => logoutAdmin()}
                    className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e293b] px-5 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 active:scale-[0.99]"
                  >
                    <LogOut size={17} />
                    {language === 'bn' ? 'লগআউট' : 'Log out'}
                  </button>
                  <p className="mt-2 text-xs text-[#5b6478]">
                    {language === 'bn' ? 'অন্য অ্যাকাউন্ট দিয়ে লগইন করুন' : 'Log in with another account'}
                  </p>
                </div>
              </div>
            ) : (
              <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
                <Suspense fallback={<TabLoadingFallback />}>
                  {renderContent()}
                </Suspense>
              </Layout>
            )}
          </div>
        </>
      ) : (
        /* Full Admin & Principal Desktop/Mobile Layout */
        <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
          <Suspense fallback={<TabLoadingFallback />}>
            {renderContent()}
          </Suspense>
        </Layout>
      )}

      {directVerifyData && (
        <VerifiedResultModal
          student={directVerifyData.student}
          exam={directVerifyData.exam}
          schoolProfile={schoolProfile}
          subjects={subjects}
          marks={marks}
          exams={exams}
          language={language}
          onClose={() => setDirectVerifyData(null)}
        />
      )}

      <LocalDataRecoveryModal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
      />
    </div>
  );
};

const App = () => {
  return (
    <AppProvider>
      <ThemeProvider>
        <AppContent />
        <PwaUpdatePrompt />
        <ToastContainer />
      </ThemeProvider>
    </AppProvider>
  );
};

export default App;
