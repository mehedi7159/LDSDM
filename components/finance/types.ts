import React from 'react';
import { 
  FinanceTransaction, 
  FundType, 
  IncomeCategory, 
  ExpenseCategory, 
  ClassFeeStructure, 
  Student 
} from '../../types';

export type FinanceTab = 
  | 'overview' 
  | 'student-fee' 
  | 'donation' 
  | 'salary' 
  | 'development' 
  | 'general-entry' 
  | 'ledger' 
  | 'fee-settings';

export type FinanceFilterCategory = 
  | 'ALL' 
  | 'STUDENT_FEES' 
  | 'DONATIONS' 
  | 'TEACHER_SALARY' 
  | 'DEVELOPMENT' 
  | 'OTHERS';

export interface FundMeta {
  name: string;
  nameBn: string;
  color: string;
  bg: string;
  border: string;
  iconBg: string;
}

export const FUND_METAS: Record<FundType, FundMeta> = {
  GENERAL: { 
    name: 'General Fund', 
    nameBn: 'সাধারণ তহবিল', 
    color: 'text-blue-700', 
    bg: 'bg-blue-50/60', 
    border: 'border-blue-200/80',
    iconBg: 'bg-blue-600'
  },
  ZAKAT: { 
    name: 'Zakat & Fitra Fund', 
    nameBn: 'যাকাত ও ফিতরা তহবিল', 
    color: 'text-emerald-700', 
    bg: 'bg-emerald-50/60', 
    border: 'border-emerald-200/80',
    iconBg: 'bg-emerald-600'
  },
  DEVELOPMENT: { 
    name: 'Development Fund', 
    nameBn: 'উন্নয়ন ও নির্মাণ তহবিল', 
    color: 'text-amber-700', 
    bg: 'bg-amber-50/60', 
    border: 'border-amber-200/80',
    iconBg: 'bg-amber-600'
  },
  ORPHAN_AID: { 
    name: 'Lillah & Orphan Aid', 
    nameBn: 'লিল্লাহ ও এতিম তহবিল', 
    color: 'text-purple-700', 
    bg: 'bg-purple-50/60', 
    border: 'border-purple-200/80',
    iconBg: 'bg-purple-600'
  },
  BOOK_BANK: { 
    name: 'Book & Library Fund', 
    nameBn: 'কিতাব ও লাইব্রেরি তহবিল', 
    color: 'text-indigo-700', 
    bg: 'bg-indigo-50/60', 
    border: 'border-indigo-200/80',
    iconBg: 'bg-indigo-600'
  },
  MAHFIL: { 
    name: 'Mahfil & Events Fund', 
    nameBn: 'মাহফিল ও অনুষ্ঠান তহবিল', 
    color: 'text-rose-700', 
    bg: 'bg-rose-50/60', 
    border: 'border-rose-200/80',
    iconBg: 'bg-rose-600'
  },
};
