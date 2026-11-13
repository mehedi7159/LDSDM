/**
 * verify-executive-dead-tiles.ts — scripted proof for the executive
 * dashboard dead-tiles fix (Fix master #1).
 *
 * Bug: ExecutiveInstitutionalDashboard calls onNavigate('academic_reports' |
 * 'attendance' | 'web_results'), but the onNavigate handler in
 * ReportsSettingsManager only branched on students/teachers/marks/results/
 * finance/notices — the three ids fell through silently, so the tiles and
 * the "গ্রাফিক্যাল রিপোর্ট" button did nothing.
 *
 * Rule under test: the handler maps academic_reports -> 'academic_reports'
 * (AcademicManager analytics), attendance -> 'attendance'
 * (AttendanceManager), web_results -> 'web_results' (ExamResultsManager
 * web_results — the INTERNAL results tab, NOT 'public_web_results',
 * which is the public portal manager), and any other id toasts
 * "এই মডিউল খোলা যায়নি" instead of failing silently.
 *
 * Run: npx tsx scripts/verify-executive-dead-tiles.ts
 */
import { readFileSync } from 'fs';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const src = readFileSync('components/settings/ReportsSettingsManager.tsx', 'utf8');
const start = src.indexOf('<ExecutiveInstitutionalDashboard');
const end = src.indexOf('/>', start);
const handler = start === -1 || end === -1 ? '' : src.slice(start, end);
check('executive handler found', handler.length > 0);

check("academic_reports -> onNavigateTab('academic_reports')",
  handler.includes("tab === 'academic_reports'") && handler.includes("onNavigateTab('academic_reports')"));
check("attendance -> onNavigateTab('attendance')",
  handler.includes("tab === 'attendance'") && handler.includes("onNavigateTab('attendance')"));
check("web_results -> onNavigateTab('web_results') (internal tab, not public portal)",
  handler.includes("tab === 'web_results'") && handler.includes("onNavigateTab('web_results')"));
check("web_results does NOT route to 'public_web_results'",
  !handler.includes("onNavigateTab('public_web_results')"));
check("default branch toasts 'এই মডিউল খোলা যায়নি'",
  handler.includes('এই মডিউল খোলা যায়নি'));

console.log(failures === 0 ? '\nALL EXECUTIVE-DEAD-TILES CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
