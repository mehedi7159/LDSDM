/**
 * Fee types as DATA, not hardcoded columns (2 Nov 2026 Fee Setup redesign).
 *
 * The institute's fee system, in the principal's own words:
 * - Admission fee: one-time, at admission, NEW students only.
 * - Session fee: yearly, at year change, CONTINUING students only
 *   (old students pay NO admission fee).
 * - Tuition fee: monthly, recurring.
 * - Exam fee: per exam, collected by CLASS TEACHERS — never the accountant.
 * - Food fee: NOT charged now. The type stays in the list (present but
 *   disabled) so its stored values are never deleted — the setup UI
 *   hides it and charging ignores it.
 * - Other fees (registration, form fillup, book, ...) are ordinary types
 *   in this list: adding a type needs no code change, just a new entry
 *   in the stored feeTypes list (the setup page has an add-type form).
 *
 * Per-class amounts live on ClassFeeStructure.amounts (feeTypeId -> amount).
 * Legacy fields (monthlyTuition, admissionFee, examFee, boardingFee,
 * bookFee) are KEPT in stored records and dual-written on save so old
 * readers keep working — but the new UI, the student institute base,
 * and monthly dues read the amounts map, never the legacy fields.
 */

export type FeeFrequency = 'admission' | 'yearly' | 'monthly' | 'per_exam' | 'per_event';
export type FeeAppliesTo = 'new' | 'continuing' | 'all';
export type FeeCollector = 'accountant' | 'class_teacher';

export interface FeeTypeDef {
  id: string;
  labelBn: string;
  labelEn: string;
  frequency: FeeFrequency;
  appliesTo: FeeAppliesTo;
  collector: FeeCollector;
  enabled: boolean;
}

/** Seed list. `food` is present-but-disabled: not charged, values kept. */
export const DEFAULT_FEE_TYPES: FeeTypeDef[] = [
  { id: 'tuition', labelBn: 'মাসিক বেতন', labelEn: 'Tuition', frequency: 'monthly', appliesTo: 'all', collector: 'accountant', enabled: true },
  { id: 'admission', labelBn: 'ভর্তি ফি', labelEn: 'Admission Fee', frequency: 'admission', appliesTo: 'new', collector: 'accountant', enabled: true },
  { id: 'admission_form', labelBn: 'ভর্তি ফরম ফি', labelEn: 'Admission Form Fee', frequency: 'admission', appliesTo: 'new', collector: 'accountant', enabled: true },
  { id: 'session', labelBn: 'সেশন ফি', labelEn: 'Session Fee', frequency: 'yearly', appliesTo: 'continuing', collector: 'accountant', enabled: true },
  { id: 'exam', labelBn: 'পরীক্ষার ফি', labelEn: 'Exam Fee', frequency: 'per_exam', appliesTo: 'all', collector: 'class_teacher', enabled: true },
  { id: 'registration', labelBn: 'রেজিস্ট্রেশন ফি', labelEn: 'Registration Fee', frequency: 'per_event', appliesTo: 'all', collector: 'accountant', enabled: true },
  { id: 'form_fillup', labelBn: 'ফরম ফিলাপ ফি', labelEn: 'Form Fillup Fee', frequency: 'per_event', appliesTo: 'all', collector: 'accountant', enabled: true },
  { id: 'book', labelBn: 'কিতাব ফি', labelEn: 'Book Fee', frequency: 'per_event', appliesTo: 'all', collector: 'accountant', enabled: true },
  { id: 'food', labelBn: 'খাবার ফি', labelEn: 'Food Fee', frequency: 'monthly', appliesTo: 'all', collector: 'accountant', enabled: false },
];

/**
 * The institute's confirmed fee chart (principal's banner, 2 Nov 2026):
 * admission fee / admission form / monthly tuition / exam fee, in taka.
 * Saved as the Fee Setup defaults by the one-time seeding in AppContext;
 * the principal changes any value later from the Fee Setup page.
 * Class 10 has no admission/admission-form fee (banner '-').
 * Session / food / registration / book have no banner amounts — unset.
 */
export const BANNER_CLASS_FEES: Record<string, {
  tuition: number; admission: number; admission_form: number; exam: number;
}> = {
  'Play': { tuition: 700, admission: 1000, admission_form: 100, exam: 200 },
  'Class 1': { tuition: 700, admission: 1000, admission_form: 100, exam: 200 },
  'Class 2': { tuition: 900, admission: 1200, admission_form: 100, exam: 200 },
  'Class 3': { tuition: 1000, admission: 1500, admission_form: 100, exam: 250 },
  'Class 4': { tuition: 1000, admission: 1500, admission_form: 100, exam: 300 },
  'Class 5': { tuition: 1000, admission: 1500, admission_form: 100, exam: 300 },
  'Class 6': { tuition: 1200, admission: 1700, admission_form: 100, exam: 350 },
  'Class 7': { tuition: 1200, admission: 1700, admission_form: 100, exam: 350 },
  'Class 8': { tuition: 1400, admission: 1800, admission_form: 200, exam: 400 },
  'Class 9': { tuition: 1500, admission: 2000, admission_form: 200, exam: 400 },
  'Class 10': { tuition: 1500, admission: 0, admission_form: 0, exam: 400 },
};

export const FEE_FREQUENCY_LABELS: Record<FeeFrequency, string> = {
  admission: 'ভর্তির সময় (একবার)',
  yearly: 'বছরে একবার',
  monthly: 'মাসিক',
  per_exam: 'পরীক্ষা প্রতি',
  per_event: 'প্রয়োজনে',
};

export const FEE_APPLIES_TO_LABELS: Record<FeeAppliesTo, string> = {
  new: 'নতুন শিক্ষার্থী',
  continuing: 'পুরাতন শিক্ষার্থী',
  all: 'সব শিক্ষার্থী',
};

export const FEE_COLLECTOR_LABELS: Record<FeeCollector, string> = {
  accountant: 'হিসাবরক্ষক',
  class_teacher: 'শ্রেণি শিক্ষক',
};

export function feeTypeById(types: FeeTypeDef[], id: string): FeeTypeDef | undefined {
  return types.find(t => t.id === id);
}

export function enabledFeeTypes(types: FeeTypeDef[]): FeeTypeDef[] {
  return types.filter(t => t.enabled);
}

export function isFeeTypeEnabled(types: FeeTypeDef[] | undefined, id: string): boolean {
  if (!types) return id !== 'food';
  return types.find(t => t.id === id)?.enabled === true;
}

/** Legacy fields -> amounts map (first-load seeding; stored values kept). */
export function amountsFromLegacy(struct: {
  monthlyTuition?: number;
  admissionFee?: number;
  examFee?: number;
  boardingFee?: number;
  bookFee?: number;
}): Record<string, number> {
  return {
    tuition: Number(struct.monthlyTuition) || 0,
    admission: Number(struct.admissionFee) || 0,
    exam: Number(struct.examFee) || 0,
    book: Number(struct.bookFee) || 0,
    food: Number(struct.boardingFee) || 0,
  };
}

/** Amounts map for a structure (legacy-seeded when the map is absent). */
export function structureAmounts(struct: {
  amounts?: Record<string, number>;
  monthlyTuition?: number;
  admissionFee?: number;
  examFee?: number;
  boardingFee?: number;
  bookFee?: number;
}): Record<string, number> {
  if (struct.amounts && typeof struct.amounts === 'object') return struct.amounts;
  return amountsFromLegacy(struct);
}

export function amountFor(struct: Parameters<typeof structureAmounts>[0], typeId: string): number {
  return Number(structureAmounts(struct)[typeId]) || 0;
}

/**
 * The one-time banner seeding migrates Play ONLY while it is still
 * exactly the old legacy state (500 tuition, nothing else). Any other
 * Play record — an edited tuition, a set admission/exam amount, any
 * food/book amount — returns false, so the seeding never overwrites
 * a value the principal (or an earlier save) has already set.
 */
export function isUnmigratedLegacyPlayStructure(
  struct: Parameters<typeof structureAmounts>[0] & { classLevel?: string } | undefined | null,
): boolean {
  if (!struct || struct.classLevel !== 'Play') return false;
  if ((Number(struct.monthlyTuition) || 0) !== 500) return false;
  if ((Number(struct.admissionFee) || 0) !== 0) return false;
  if ((Number(struct.examFee) || 0) !== 0) return false;
  if ((Number(struct.boardingFee) || 0) !== 0) return false;
  if ((Number(struct.bookFee) || 0) !== 0) return false;
  const amounts = structureAmounts(struct);
  if ((Number(amounts.tuition) || 0) !== 500) return false;
  for (const id of ['admission', 'admission_form', 'exam', 'book', 'food']) {
    if ((Number(amounts[id]) || 0) !== 0) return false;
  }
  return true;
}

/**
 * Dual-write target: legacy fields kept in sync with the amounts map so
 * old readers (fee collection breakdown, legacy dues fallback) keep
 * working. The amounts map remains the source of truth for the new UI.
 */
export function toLegacyFields(amounts: Record<string, number>): {
  monthlyTuition: number;
  admissionFee: number;
  examFee: number;
  boardingFee: number;
  bookFee: number;
} {
  return {
    monthlyTuition: Number(amounts.tuition) || 0,
    admissionFee: Number(amounts.admission) || 0,
    examFee: Number(amounts.exam) || 0,
    boardingFee: Number(amounts.food) || 0,
    bookFee: Number(amounts.book) || 0,
  };
}

/**
 * Monthly institute base for a class: tuition + food ONLY when the food
 * type is enabled. Food is disabled by default (not charged now), so the
 * base is tuition-only unless the institute re-enables it.
 */
export function monthlyBaseFor(
  struct: Parameters<typeof structureAmounts>[0] | undefined,
  feeTypes?: FeeTypeDef[]
): number {
  if (!struct) return 0;
  const amounts = structureAmounts(struct);
  const tuition = Number(amounts.tuition) || 0;
  const food = isFeeTypeEnabled(feeTypes, 'food') ? Number(amounts.food) || 0 : 0;
  return tuition + food;
}

/** One-time / event amounts never enter monthly dues — this is the guard. */
export function isMonthlyFeeType(typeId: string): boolean {
  return typeId === 'tuition' || typeId === 'food';
}
