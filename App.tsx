import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { StudentManager } from './components/StudentManager';
import { SubjectManager } from './components/SubjectManager';
import { AcademicManager } from './components/academic/AcademicManager';
import { MarksEntry } from './components/MarksEntry';
import { AttendanceEntry } from './components/AttendanceEntry';
import { AttendanceManager } from './components/attendance/AttendanceManager';
import { ResultGenerator } from './components/ResultView';
import { ClassResultView } from './components/ClassResultView';
import { Settings } from './components/Settings';
import { FinanceManager } from './components/FinanceManager';
import { ExamResultsManager } from './components/examination/ExamResultsManager';
import { StaffManager } from './components/staff/StaffManager';
import { ReportsSettingsManager } from './components/settings/ReportsSettingsManager';
import { PortalsServicesManager } from './components/portals/PortalsServicesManager';
import { SpecializedServicesManager } from './components/services/SpecializedServicesManager';
import { AccessRestrictedView } from './components/AccessRestrictedView';
import { Button } from './components/ui/Button';
import { Download, Loader2 } from 'lucide-react';
import { VerifiedResultModal } from './components/VerifiedResultModal';
import { LocalDataRecoveryModal } from './components/LocalDataRecoveryModal';
import { SuperAdminAuditPage } from './components/SuperAdminAuditPage';
import { UserRoleManager } from './components/UserRoleManager';
import { AuthPage } from './components/AuthPage';
import { LandingView } from './components/LandingView';
import { PendingApprovalView } from './components/PendingApprovalView';
import { StudentReportView } from './components/StudentReportView';
import { AttendanceReportView } from './components/AttendanceReportView';
import { FinanceReportView } from './components/FinanceReportView';
import { AdminReportView } from './components/AdminReportView';
import { WebResultView } from './components/WebResultView';
import { StudentIDCardGenerator } from './components/StudentIDCardGenerator';
import { StudentProfileView } from './components/StudentProfileView';
import { NoticeBoard } from './components/NoticeBoard';
import { ExamManager } from './components/ExamManager';
import { DataSecurityBackupCenter } from './components/DataSecurityBackupCenter';
import { MobileRoleAppView } from './components/MobileRoleAppView';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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

  useEffect(() => {
    // Fail-safe: Automatically dismiss loading screen after 1.2s max if auth is taking time
    const timer = setTimeout(() => {
      setBypassAuthLoading(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Helper function to resolve tab authorization
  const isTabAllowedForUser = (tab: string): boolean => {
    const isOwnerAdmin = isSuperAdmin || isAdmin || currentUser?.role === 'super_admin' || (authUser?.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
    if (isOwnerAdmin) return true;

    // Principal has administrative access to analytical and management tabs
    if (currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal' || userRole === 'principal') {
      if (tab === 'backup_recovery' || tab === 'superadmin_audit') return false;
      return true;
    }

    // Public / universal tabs
    if (tab === 'dashboard' || tab === 'academic_reports' || tab === 'web_results' || tab === 'student_profile' || tab === 'notice_board') {
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
      case 'class_section_setup':
      case 'teacher_assignment':
      case 'class_routine':
      case 'syllabus_planner':
      case 'academic_calendar':
      case 'academic_reports':
        return isAdmin || hasPermission('subjects.view') || hasPermission('subjectAssignments.view') || currentUser?.role === 'teacher';
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
      case 'user_roles':
      case 'staff_roles':
      case 'staff_assignments':
      case 'staff_payroll':
      case 'staff_leaves':
      case 'staff_id_cards':
      case 'staff_analytics':
        return isAdmin || hasPermission('roles.view') || hasPermission('users.view') || currentUser?.role === 'principal';
      case 'settings':
      case 'branding_settings':
        return isAdmin || hasPermission('institution.settings.view');
      case 'backup_recovery':
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
        return isAdmin || currentUser?.role === 'principal' || currentUser?.role === 'teacher';
      case 'boarding_mess':
        return isAdmin || currentUser?.role === 'principal' || currentUser?.role === 'teacher';
      case 'islamic_welfare':
        return isAdmin || currentUser?.role === 'principal' || currentUser?.role === 'accountant';
      case 'book_bank':
      case 'book_issues':
      case 'transport_fleet':
      case 'mahfil_events':
      case 'activities_clubs':
        return true;
      default:
        return true;
    }
  };

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

    // 4. Fast-path check: If immediately allowed, do nothing
    const isAllowed = isTabAllowedForUser(activeTab);
    if (isAllowed) {
      return;
    }

    // 5. Debounced verification check (300ms stabilization window):
    // Prevents false-negative redirects while claims, roles, or member records are settling asynchronously
    debounceRedirectRef.current = setTimeout(() => {
      const stillAllowed = isTabAllowedForUser(activeTab);
      if (!stillAllowed) {
        if (activeTab !== 'dashboard') {
          console.warn(`[Navigation] Role does not possess permission for "${activeTab}". Redirecting to dashboard.`);
          setActiveTab('dashboard');
        }
      }
    }, 300);

    return () => {
      if (debounceRedirectRef.current) {
        clearTimeout(debounceRedirectRef.current);
      }
    };
  }, [activeTab, authUser, authClaims, authRole, isAdmin, isSuperAdmin, currentMember, isAuthReady]);
  
  // States for Result switching
  const [resultMode, setResultMode] = useState<'individual' | 'class'>('individual');
  const [classViewConfig, setClassViewConfig] = useState({ classLevel: classes[0]?.name || '', examId: '' });
  const [isGenerating, setIsGenerating] = useState(false);

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
    const font = schoolProfile.banglaFont || 'Noto Sans Bengali';
    const numFont = schoolProfile.banglaNumberFont || 'Noto Sans Bengali';
    
    root.style.setProperty('--bangla-font', `'${font}', 'Noto Sans Bengali', 'Anek Bangla', sans-serif`);
    root.style.setProperty('--bangla-num-font', `'${numFont}', 'Noto Sans Bengali', 'Anek Bangla', sans-serif`);
  }, [schoolProfile.banglaFont, schoolProfile.banglaNumberFont]);

  const handleDownloadTabulation = async () => {
      const element = document.getElementById('tabulation-sheet');
      if (!element) {
          alert('Content not ready');
          return;
      }
      
      setIsGenerating(true);

      // Dedicated off-screen stage at (0, 0)
      const stage = document.createElement('div');
      stage.id = 'tabulation-render-stage';
      stage.style.position = 'fixed';
      stage.style.left = '0';
      stage.style.top = '0';
      stage.style.zIndex = '-99999';

      try {
          if (typeof document !== 'undefined' && (document as any).fonts) {
              await (document as any).fonts.ready.catch(() => {});
          }

          // Measure natural table width
          const tableEl = element.querySelector('table');
          const minTargetWidth = 1123; // Exactly 297mm at 96 DPI
          const contentWidth = Math.max(tableEl ? tableEl.scrollWidth + 32 : element.scrollWidth, minTargetWidth);

          stage.style.width = `${contentWidth}px`;
          stage.style.backgroundColor = '#ffffff';
          stage.style.margin = '0';
          stage.style.padding = '0';
          stage.style.overflow = 'hidden';
          stage.style.boxSizing = 'border-box';
          document.body.appendChild(stage);

          const clone = element.cloneNode(true) as HTMLElement;
          clone.style.width = `${contentWidth}px`;
          clone.style.maxWidth = 'none';
          clone.style.margin = '0';
          clone.style.boxShadow = 'none';
          clone.style.backgroundColor = '#ffffff';

          // Ensure all inner scrollers are fully expanded
          clone.querySelectorAll('.overflow-x-auto').forEach((el: any) => {
              el.style.overflow = 'visible';
              el.style.width = '100%';
              el.style.maxWidth = 'none';
          });

          // Strip any shadows or unwanted decorations
          clone.querySelectorAll('*').forEach((el: any) => {
              if (el.style) el.style.boxShadow = 'none';
              el.classList.remove('shadow-2xl', 'shadow-xl', 'shadow-lg', 'shadow-md', 'shadow-sm', 'shadow');
          });

          stage.appendChild(clone);
          await new Promise(resolve => setTimeout(resolve, 150));

          const canvas = await html2canvas(stage, {
              scale: 2.2, // Crisp high-res rendering
              useCORS: true,
              logging: false,
              allowTaint: true,
              backgroundColor: '#ffffff',
              scrollX: 0,
              scrollY: 0,
              x: 0,
              y: 0,
              width: contentWidth,
              height: stage.offsetHeight
          });

          // Standard A4 Landscape: 297mm x 210mm
          const pdf = new jsPDF({
              orientation: 'landscape',
              unit: 'mm',
              format: 'a4',
              compress: true
          });

          const pageWidth = 297;
          const pageHeight = 210;
          const margin = 5; // 5mm uniform margin
          const printableWidth = pageWidth - (margin * 2); // 287mm
          const printableHeight = pageHeight - (margin * 2); // 200mm

          // Strictly fit entire tabulation sheet on EXACTLY ONE page without leaving anything out
          const scaleW = printableWidth / canvas.width;
          const scaleH = printableHeight / canvas.height;
          const fitScale = Math.min(scaleW, scaleH);

          const renderWidth = canvas.width * fitScale;
          const renderHeight = canvas.height * fitScale;
          const xOffset = margin + Math.max(0, (printableWidth - renderWidth) / 2);
          const yOffset = margin + Math.max(0, (printableHeight - renderHeight) / 2);

          const imgData = canvas.toDataURL('image/jpeg', 0.96);
          pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');

          const examName = exams.find(e => e.id === classViewConfig.examId)?.name || 'Exam';
          pdf.save(`Tabulation_${classViewConfig.classLevel}_${examName}.pdf`);
      } catch (err) {
          console.error('Error generating Tabulation PDF:', err);
          alert('Error generating Tabulation PDF. Please try again.');
      } finally {
          if (document.body.contains(stage)) {
              document.body.removeChild(stage);
          }
          setIsGenerating(false);
      }
  };

  const renderContent = () => {
    const isOwnerAdmin = isSuperAdmin || (authUser?.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();

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
        return (isOwnerAdmin || isAdmin || isSuperAdmin || hasPermission('roles.view') || hasPermission('users.view')) 
          ? <StaffManager initialSubTab="roles" onNavigateTab={(tab) => setActiveTab(tab)} /> 
          : <AccessRestrictedView moduleName={language === 'bn' ? 'ব্যবহারকারী ও রোল নিয়ন্ত্রণ' : 'User Roles & Access'} onGoToResults={() => setActiveTab('dashboard')} />;
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
      case 'guardian_portal':
        return <PortalsServicesManager initialSubTab="guardian_portal" onNavigateTab={(tab) => setActiveTab(tab)} />;
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
      {isNonAdminRole ? (
        <>
          {/* Dedicated Native Mobile App View for Teacher, Cashier, Parent, Staff */}
          <div className="block md:hidden">
            <MobileRoleAppView 
              onLogout={() => logoutAdmin()} 
              renderModuleContent={() => renderContent()}
            />
          </div>
          {/* Standard Desktop View */}
          <div className="hidden md:block">
            <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
              {renderContent()}
            </Layout>
          </div>
        </>
      ) : (
        /* Full Admin & Principal Desktop/Mobile Layout */
        <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
          {renderContent()}
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
      <AppContent />
    </AppProvider>
  );
};

export default App;
