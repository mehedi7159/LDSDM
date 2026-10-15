import {
  getDefaultInstitutionConfig,
  isModuleEnabled,
  validateModuleDependencies,
  getTerm,
  getThemeConfig,
  getFinanceConfig,
  COMMON_MODULES,
  MADRASAH_MODULES,
  SCHOOL_MODULES,
} from './institutionConfigEngine';
import { ModuleKey } from '../types';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
}

/**
 * Runs validation suite for School and Madrasah configuration engine.
 */
export function runInstitutionConfigValidation(): {
  allPassed: boolean;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  const addResult = (suite: string, name: string, condition: boolean, message?: string) => {
    results.push({
      suite,
      name,
      passed: condition,
      message: condition ? 'OK' : message || 'Assertion failed',
    });
  };

  // 1. SCHOOL DEFAULT CONFIGURATION SUITE
  const schoolConfig = getDefaultInstitutionConfig('SCHOOL');
  addResult(
    'SCHOOL Config',
    'Has institutionType SCHOOL',
    schoolConfig.institutionType === 'SCHOOL'
  );
  addResult(
    'SCHOOL Config',
    'All COMMON_MODULES are enabled',
    COMMON_MODULES.every((mod) => isModuleEnabled(schoolConfig, mod))
  );
  addResult(
    'SCHOOL Config',
    'School-specific modules are enabled (TRANSPORT, ACTIVITIES, etc.)',
    SCHOOL_MODULES.every((mod) => isModuleEnabled(schoolConfig, mod))
  );
  addResult(
    'SCHOOL Config',
    'Madrasah-only modules are disabled (ZAKAT, MAHFIL, etc.)',
    MADRASAH_MODULES.every((mod) => !isModuleEnabled(schoolConfig, mod))
  );
  addResult(
    'SCHOOL Config',
    'School theme preset is SCHOOL and has correct palette',
    schoolConfig.themeSettings.preset === 'SCHOOL' && schoolConfig.themeSettings.primaryColor === '#1e40af'
  );
  addResult(
    'SCHOOL Config',
    'School finance has Transport & Sports funds and no Zakat fund',
    schoolConfig.financeConfig?.enabledFunds.some((f) => f.fundKey === 'TRANSPORT') === true &&
    schoolConfig.financeConfig?.enabledFunds.some((f) => f.fundKey === 'ZAKAT') === false
  );
  addResult(
    'SCHOOL Config',
    'Terminology resolves School Headmaster/Principal & Student',
    getTerm(schoolConfig, 'principal', 'en').includes('Principal') &&
    getTerm(schoolConfig, 'student', 'bn').includes('শিক্ষার্থী')
  );

  // 2. MADRASAH DEFAULT CONFIGURATION SUITE
  const madrasahConfig = getDefaultInstitutionConfig('MADRASAH');
  addResult(
    'MADRASAH Config',
    'Has institutionType MADRASAH',
    madrasahConfig.institutionType === 'MADRASAH'
  );
  addResult(
    'MADRASAH Config',
    'All COMMON_MODULES are enabled',
    COMMON_MODULES.every((mod) => isModuleEnabled(madrasahConfig, mod))
  );
  addResult(
    'MADRASAH Config',
    'Madrasah-specific modules are enabled (ZAKAT, DONATIONS, MAHFIL, BOARDING, BOOK_BANK, ORPHAN_AID)',
    MADRASAH_MODULES.every((mod) => isModuleEnabled(madrasahConfig, mod))
  );
  addResult(
    'MADRASAH Config',
    'School-only modules are disabled (TRANSPORT, CLUBS, etc.)',
    SCHOOL_MODULES.every((mod) => !isModuleEnabled(madrasahConfig, mod))
  );
  addResult(
    'MADRASAH Config',
    'Madrasah theme preset is MADRASAH with emerald palette',
    madrasahConfig.themeSettings.preset === 'MADRASAH' && madrasahConfig.themeSettings.primaryColor === '#065f46'
  );
  addResult(
    'MADRASAH Config',
    'Madrasah finance has ZAKAT and ORPHAN_AID funds',
    madrasahConfig.financeConfig?.enabledFunds.some((f) => f.fundKey === 'ZAKAT') === true &&
    madrasahConfig.financeConfig?.enabledFunds.some((f) => f.fundKey === 'ORPHAN_AID') === true
  );
  addResult(
    'MADRASAH Config',
    'Terminology resolves Madrasah Muhtamim & Ustadh',
    getTerm(madrasahConfig, 'principal', 'bn').includes('মুহতামিম') &&
    getTerm(madrasahConfig, 'teacher', 'bn').includes('উস্তাদ')
  );

  // 3. MODULE DEPENDENCIES SUITE
  const validModules: ModuleKey[] = ['STUDENTS', 'FEES', 'BOARDING', 'FINANCE', 'ZAKAT'];
  const validCheck = validateModuleDependencies(validModules);
  addResult(
    'Module Dependencies',
    'Valid dependency combinations pass validation',
    validCheck.valid
  );

  const brokenModules: ModuleKey[] = ['BOARDING']; // Missing STUDENTS and FEES
  const brokenCheck = validateModuleDependencies(brokenModules);
  addResult(
    'Module Dependencies',
    'Missing required module dependencies are detected',
    !brokenCheck.valid && brokenCheck.missingDependencies.some((d) => d.module === 'BOARDING')
  );

  // 4. BACKWARD COMPATIBILITY & DEFAULT FALLBACK SUITE
  addResult(
    'Backward Compatibility',
    'Fallback without config defaults to Madrasah ZAKAT enabled',
    isModuleEnabled(undefined, 'ZAKAT') === true
  );
  addResult(
    'Backward Compatibility',
    'Fallback without config defaults to Madrasah Terminology',
    getTerm(undefined, 'teacher', 'bn').includes('উস্তাদ')
  );
  addResult(
    'Backward Compatibility',
    'Fallback without config defaults to Madrasah Finance & Theme',
    getThemeConfig(undefined).preset === 'MADRASAH' &&
    getFinanceConfig(undefined).institutionType === 'MADRASAH'
  );

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
