import React from 'react';
import type { Student } from '../types/student';
import { 
  X, 
  User, 
  BookOpen, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Heart, 
  Award, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from 'lucide-react';

interface StudentProfileModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  language?: 'bn' | 'en';
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  student,
  isOpen,
  onClose,
  language = 'bn'
}) => {
  if (!isOpen || !student) return null;

  const isBn = language === 'bn';
  const isFormer = student.isFormer || student.status === 'Former' || student.status === 'archived';

  const getStatusBadge = () => {
    if (isFormer) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <Clock className="w-3.5 h-3.5" />
          {isBn ? 'সাবেক শিক্ষার্থী' : 'Former / Archived'}
        </span>
      );
    }
    if (student.status === 'Inactive' || student.status === 'inactive') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertCircle className="w-3.5 h-3.5" />
          {isBn ? 'স্থগিত / অনিয়মিত' : 'Inactive'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {isBn ? 'নিয়মিত শিক্ষার্থী' : 'Active Student'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Profile Banner */}
        <div className="relative bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar or Photo */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-3xl font-bold shadow-inner overflow-hidden flex-shrink-0">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-emerald-200">
                  {student.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="text-center sm:text-left space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                  {student.name}
                </h2>
                {getStatusBadge()}
              </div>
              {student.nameBn && (
                <p className="text-emerald-200/90 text-sm font-medium">
                  {student.nameBn}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-emerald-100/80 pt-1">
                {student.studentId && (
                  <span className="bg-black/20 px-2.5 py-1 rounded-lg border border-white/10 font-mono">
                    ID: {student.studentId}
                  </span>
                )}
                {(student.roll || student.rollNumber) && (
                  <span className="bg-black/20 px-2.5 py-1 rounded-lg border border-white/10 font-mono">
                    {isBn ? 'রোল:' : 'Roll:'} {student.roll || student.rollNumber}
                  </span>
                )}
                <span className="bg-emerald-600/40 px-2.5 py-1 rounded-lg border border-emerald-400/30">
                  {student.classLevel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 divide-y divide-slate-100">
          {/* Academic Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              {isBn ? 'একাডেমিক তথ্য' : 'Academic Information'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">{isBn ? 'শ্রেণি / ক্লাস' : 'Class'}</span>
                <span className="font-semibold text-slate-800">{student.classLevel || '—'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">{isBn ? 'বিভাগ / গ্রুপ' : 'Group'}</span>
                <span className="font-semibold text-slate-800">{student.group || (isBn ? 'সাধারণ' : 'General')}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">{isBn ? 'রোল নম্বর' : 'Roll'}</span>
                <span className="font-semibold text-slate-800 font-mono">{student.roll || student.rollNumber || '—'}</span>
              </div>
              {student.admissionNumber && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">{isBn ? 'ভর্তি নম্বর' : 'Admission No'}</span>
                  <span className="font-semibold text-slate-800 font-mono">{student.admissionNumber}</span>
                </div>
              )}
              {student.admissionDate && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">{isBn ? 'ভর্তির তারিখ' : 'Admission Date'}</span>
                  <span className="font-semibold text-slate-800">{student.admissionDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Personal & Demographic */}
          <div className="pt-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-600" />
              {isBn ? 'ব্যক্তিগত তথ্য' : 'Personal Details'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">{isBn ? 'লিঙ্গ' : 'Gender'}</span>
                <span className="font-semibold text-slate-800">
                  {student.gender === 'female' ? (isBn ? 'ছাত্রী' : 'Female') : (isBn ? 'ছাত্র' : 'Male')}
                </span>
              </div>
              {student.dateOfBirth && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">{isBn ? 'জন্ম তারিখ' : 'Date of Birth'}</span>
                  <span className="font-semibold text-slate-800">{student.dateOfBirth}</span>
                </div>
              )}
              {student.bloodGroup && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">{isBn ? 'রক্তের গ্রুপ' : 'Blood Group'}</span>
                  <span className="font-semibold text-rose-600 font-bold">{student.bloodGroup}</span>
                </div>
              )}
              {student.religion && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">{isBn ? 'ধর্ম' : 'Religion'}</span>
                  <span className="font-semibold text-slate-800">{student.religion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Guardian Information */}
          <div className="pt-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-emerald-600" />
              {isBn ? 'অভিভাবকের তথ্য' : 'Guardian Information'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
                <span className="text-[11px] text-slate-500 block">{isBn ? 'পিতার নাম' : "Father's Name"}</span>
                <span className="font-semibold text-slate-800">{student.fatherName || '—'}</span>
                {student.fatherNameBn && <span className="text-xs text-slate-500 block">{student.fatherNameBn}</span>}
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
                <span className="text-[11px] text-slate-500 block">{isBn ? 'মাতার নাম' : "Mother's Name"}</span>
                <span className="font-semibold text-slate-800">{student.motherName || '—'}</span>
                {student.motherNameBn && <span className="text-xs text-slate-500 block">{student.motherNameBn}</span>}
              </div>
              {student.guardianName && student.guardianName !== student.fatherName && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">{isBn ? 'অভিভাবক' : 'Guardian'}</span>
                  <span className="font-semibold text-slate-800">{student.guardianName}</span>
                </div>
              )}
              {student.guardianPhone && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">{isBn ? 'মোবাইল নম্বর' : 'Phone'}</span>
                  <a 
                    href={`tel:${student.guardianPhone}`} 
                    className="font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {student.guardianPhone}
                  </a>
                </div>
              )}
              {student.guardianEmail && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">{isBn ? 'ইমেইল' : 'Email'}</span>
                  <a 
                    href={`mailto:${student.guardianEmail}`} 
                    className="font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {student.guardianEmail}
                  </a>
                </div>
              )}
              {student.address && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 sm:col-span-2">
                  <span className="text-[11px] text-slate-500 block flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {isBn ? 'ঠিকানা' : 'Address'}
                  </span>
                  <span className="font-medium text-slate-800">{student.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Former / Leaving Reason (If applicable) */}
          {isFormer && (
            <div className="pt-5 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                {isBn ? 'মাদ্রাসা ত্যাগের বিবরণ' : 'Archived / Leaving Record'}
              </h3>
              <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl text-xs space-y-1">
                <div>
                  <span className="text-slate-500">{isBn ? 'ত্যাগের তারিখ: ' : 'Leaving Date: '}</span>
                  <span className="font-semibold text-slate-800">{student.leavingDate || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">{isBn ? 'কারণ: ' : 'Reason: '}</span>
                  <span className="font-medium text-slate-800">{student.leavingReason || (isBn ? 'উল্লেখ নেই' : 'Not specified')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono text-[11px]">
            UUID: {student.id.substring(0, 16)}...
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium transition-colors shadow-sm"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
