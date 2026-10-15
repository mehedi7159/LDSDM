import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Student, Exam, SchoolProfile } from '../types';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ResultVerificationQRProps {
  student: Student;
  exam: Exam;
  schoolProfile: SchoolProfile;
  language?: string;
  size?: number;
  className?: string;
  showText?: boolean;
  onOpenVerification?: () => void;
}

/**
 * Generate a deterministic verification signature/hash for the student's result
 */
export const generateVerificationHash = (
  student: Student,
  exam: Exam,
  schoolProfile: SchoolProfile
): string => {
  const seed = `${student.id}_${student.studentId || ''}_${exam.id}_${schoolProfile.academicYear || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0');
  const studentCode = (student.studentId || student.roll || student.id.slice(0, 4)).replace(/[^a-zA-Z0-9]/g, '');
  return `VRF-${studentCode}-${exam.id.slice(0, 3).toUpperCase()}-${hex}`;
};

/**
 * Generate the public verification URL
 */
export const getVerificationUrl = (
  student: Student,
  exam: Exam,
  schoolProfile: SchoolProfile
): string => {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin || '';
  const pathname = window.location.pathname || '';
  const hash = generateVerificationHash(student, exam, schoolProfile);
  const studentIdentifier = student.studentId || student.id;
  
  return `${origin}${pathname}?verify=1&sid=${encodeURIComponent(studentIdentifier)}&examId=${encodeURIComponent(exam.id)}&year=${encodeURIComponent(schoolProfile.academicYear || exam.academicYear)}&vhash=${encodeURIComponent(hash)}`;
};

export const ResultVerificationQR: React.FC<ResultVerificationQRProps> = ({
  student,
  exam,
  schoolProfile,
  language = 'bn',
  size = 56,
  className = '',
  showText = true,
  onOpenVerification
}) => {
  const isBn = language === 'bn';
  const verificationUrl = getVerificationUrl(student, exam, schoolProfile);
  const verificationHash = generateVerificationHash(student, exam, schoolProfile);

  return (
    <div
      onClick={onOpenVerification}
      title={isBn ? 'ডিজিটাল রেজাল্ট যাচাইকরণ দেখতে ক্লিক করুন' : 'Click to view digital verification record'}
      className={`inline-flex items-center gap-2 bg-white/95 border border-slate-300/90 rounded-lg p-1.5 print:border-black print:bg-white transition-all hover:border-emerald-500 hover:shadow-xs cursor-pointer select-none ${className}`}
    >
      {/* QR Code SVG */}
      <div className="bg-white p-0.5 rounded border border-slate-200 print:border-black shrink-0 flex items-center justify-center">
        <QRCodeSVG
          value={verificationUrl || `https://madrasha.edu.bd/verify?vhash=${verificationHash}`}
          size={size}
          level="M"
          includeMargin={false}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Verification Labels */}
      {showText && (
        <div className="flex flex-col justify-center text-left leading-tight">
          <div className="flex items-center gap-1 text-[9px] font-black text-emerald-800 print:text-black uppercase tracking-wider">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 print:hidden shrink-0" />
            <span>{isBn ? 'যাচাইকৃত সনদ' : 'VERIFIED'}</span>
          </div>
          <div className="text-[8px] text-slate-600 print:text-black font-mono font-semibold tracking-tight">
            {verificationHash}
          </div>
          <div className="text-[7.5px] text-slate-500 print:text-black mt-0.5 font-medium">
            {isBn ? 'স্ক্যান করে যাচাই করুন' : 'Scan to authenticate'}
          </div>
        </div>
      )}
    </div>
  );
};
