/**
 * Tuition-fee arrangement helpers — shared by the student admission/edit
 * form, the student profile display, and the dues computation.
 *
 * One rule, everywhere: payable = max(0, base - waiver - fund).
 * Discount types are exclusive: a student has at most one arrangement.
 * The fund part is NOT a payment transaction — it is an arrangement:
 * dues track only the student-payable part.
 */

import type { ClassFeeStructure, Student } from '../types';
import type { FeeDiscountType } from '../types/student';
import { monthlyBaseFor, type FeeTypeDef } from './feeTypes';

export type { FeeDiscountType };

export const FEE_DISCOUNT_TYPE_LABELS: Record<FeeDiscountType, string> = {
  none: 'ছাড় নেই',
  full: 'সম্পূর্ণ ওয়েভার',
  partial: 'আংশিক ওয়েভার',
  etim: 'এতিম ফান্ড',
  other: 'অন্যান্য ফান্ড',
};

export const FEE_DISCOUNT_TYPES: FeeDiscountType[] = ['none', 'full', 'partial', 'etim', 'other'];

/** Fixed fund-source label for the etim arrangement. */
export const ETIM_FUND_SOURCE = 'এতিম ফান্ড';

/**
 * Institute-set monthly base for a class (same rule dues use).
 * New model (2 Nov 2026): tuition + food ONLY when the food fee type is
 * enabled. Food is disabled by default (not charged now), so the base is
 * tuition-only unless the institute re-enables it. Stored per-student
 * arrangements are untouched — only the class base changes.
 */
export function classFeeBase(struct: ClassFeeStructure | undefined, feeTypes?: FeeTypeDef[]): number {
  if (!struct) return 0;
  return monthlyBaseFor(struct, feeTypes);
}

export function toFeeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Raw form inputs (strings from inputs) for one arrangement. */
export interface FeeArrangementInput {
  discountType: FeeDiscountType;
  baseAmount: number;
  waiverAmount: number;
  fundAmount: number;
  fundSource: string;
}

/** Normalized, storable arrangement. Payable never goes negative. */
export interface FeeArrangement extends FeeArrangementInput {
  payableAmount: number;
}

/**
 * Normalize one arrangement by type (exclusive parts):
 * none -> waiver 0, fund 0, no source; full -> waiver = base, fund 0;
 * partial -> fund 0, no source; etim -> waiver 0, source fixed;
 * other -> waiver 0, source as typed.
 */
export function normalizeFeeArrangement(input: FeeArrangementInput): FeeArrangement {
  const base = toFeeNumber(input.baseAmount);
  let waiver = 0;
  let fund = 0;
  let fundSource = '';
  switch (input.discountType) {
    case 'full':
      waiver = base;
      break;
    case 'partial':
      waiver = Math.min(toFeeNumber(input.waiverAmount), base);
      break;
    case 'etim':
      fund = Math.min(toFeeNumber(input.fundAmount), base);
      fundSource = ETIM_FUND_SOURCE;
      break;
    case 'other':
      fund = Math.min(toFeeNumber(input.fundAmount), base);
      fundSource = (input.fundSource || '').trim();
      break;
    case 'none':
    default:
      break;
  }
  return {
    discountType: input.discountType,
    baseAmount: base,
    waiverAmount: waiver,
    fundAmount: fund,
    fundSource,
    payableAmount: Math.max(0, base - waiver - fund),
  };
}

/** Bangla validation error, or null when the arrangement is valid. */
export function validateFeeArrangement(input: FeeArrangementInput): string | null {
  const base = toFeeNumber(input.baseAmount);
  if (input.discountType === 'none' || input.discountType === 'full') return null;
  if (input.discountType === 'partial') {
    const waiver = toFeeNumber(input.waiverAmount);
    if (waiver <= 0) return 'আংশিক ওয়েভারের টাকার পরিমাণ দিন।';
    if (waiver >= base) return 'আংশিক ওয়েভার প্রতিষ্ঠান ফি-এর চেয়ে কম হতে হবে (সমান হলে সম্পূর্ণ ওয়েভার বাছুন)।';
    return null;
  }
  // etim / other fund types
  const fund = toFeeNumber(input.fundAmount);
  if (fund <= 0) return 'ফান্ড থেকে কত টাকা দেওয়া হবে, তা দিন।';
  if (fund >= base) return 'ফান্ডের টাকা প্রতিষ্ঠান ফি-এর চেয়ে কম হতে হবে।';
  if (input.discountType === 'other' && !(input.fundSource || '').trim()) {
    return 'অন্যান্য ফান্ডের নাম/উৎস লিখুন।';
  }
  return null;
}

/** Arrangement stored on a student record, or the graceful default (no discount). */
export function feeArrangementOf(student: Student): FeeArrangement {
  const type = (student.feeDiscountType || 'none') as FeeDiscountType;
  if (type === 'none' || !FEE_DISCOUNT_TYPES.includes(type)) {
    return {
      discountType: 'none',
      baseAmount: toFeeNumber(student.feeBaseAmount),
      waiverAmount: 0,
      fundAmount: 0,
      fundSource: '',
      payableAmount: toFeeNumber(student.feeBaseAmount),
    };
  }
  return normalizeFeeArrangement({
    discountType: type,
    baseAmount: toFeeNumber(student.feeBaseAmount),
    waiverAmount: toFeeNumber(student.feeWaiverAmount),
    fundAmount: toFeeNumber(student.feeFundAmount),
    fundSource: student.feeFundSource || '',
  });
}

/** True when the student has a real discount/fund arrangement (not the default). */
export function hasFeeArrangement(student: Student): boolean {
  const type = student.feeDiscountType;
  return !!type && type !== 'none' && FEE_DISCOUNT_TYPES.includes(type);
}
