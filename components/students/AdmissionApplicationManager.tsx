import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Student } from '../../types';
import { formatNumber, formatSafeDate } from '../../services/utils';
import { Button } from '../ui/Button';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  UserCheck, 
  Phone, 
  Printer, 
  Calendar, 
  User, 
  GraduationCap,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export interface AdmissionApplication {
  id: string;
  applicationNo: string;
  applicantName: string;
  applicantNameBn?: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  desiredClass: string;
  fatherName: string;
  fatherNameBn?: string;
  motherName: string;
  guardianPhone: string;
  guardianEmail?: string;
  previousSchool?: string;
  address: string;
  appliedDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
}

const STORAGE_KEY = 'madrasah_admission_applications';

export const AdmissionApplicationManager: React.FC<{
  onEnrollStudent?: (app: AdmissionApplication) => void;
}> = ({ onEnrollStudent }) => {
  const { classes, addStudent, language } = useApp();
  const isBn = language === 'bn';

  // Stored applications with initial mock data
  const [applications, setApplications] = useState<AdmissionApplication[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved applications:', e);
    }

    const currentYear = new Date().getFullYear();
    return [
      {
        id: 'app-01',
        applicationNo: `ADM-${currentYear}-001`,
        applicantName: 'Abdullah Al Mahmud',
        applicantNameBn: 'আব্দুল্লাহ আল মাহমুদ',
        gender: 'male',
        dateOfBirth: '2016-04-12',
        desiredClass: classes[0]?.name || '১ম শ্রেণি',
        fatherName: 'Md. Rafiqul Islam',
        fatherNameBn: 'মোঃ রফিকুল ইসলাম',
        motherName: 'Mahmuda Begum',
        guardianPhone: '01711223344',
        previousSchool: 'দারুল কুরআন নূরানী মাদ্রাসা',
        address: 'গ্রাম: চরপাড়া, থানা: সদর, জেলা: ময়মনসিংহ',
        appliedDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        status: 'PENDING',
        notes: 'হিফজ বিভাগে পড়ার বিশেষ আগ্রহ রয়েছে।'
      },
      {
        id: 'app-02',
        applicationNo: `ADM-${currentYear}-002`,
        applicantName: 'Muhammad Salman',
        applicantNameBn: 'মুহাম্মদ সালমান',
        gender: 'male',
        dateOfBirth: '2015-08-20',
        desiredClass: classes[1]?.name || '২য় শ্রেণি',
        fatherName: 'Abul Kashem',
        fatherNameBn: 'আবুল কাশেম',
        motherName: 'Salma Khatun',
        guardianPhone: '01819556677',
        previousSchool: 'ইত্তেহাদুল মাদারিস নূরানী মক্তব',
        address: 'পূর্ব বাজার, জামিয়া রোড, ঢাকা',
        appliedDate: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
        status: 'PENDING'
      }
    ];
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AdmissionApplication | null>(null);

  // Form State for new application intake
  const [formData, setFormData] = useState({
    applicantName: '',
    applicantNameBn: '',
    gender: 'male' as 'male' | 'female',
    dateOfBirth: '',
    desiredClass: classes[0]?.name || '',
    fatherName: '',
    fatherNameBn: '',
    motherName: '',
    guardianPhone: '',
    guardianEmail: '',
    previousSchool: '',
    address: '',
    notes: ''
  });

  // Save to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    } catch (e) {
      console.error('Failed to save applications:', e);
    }
  }, [applications]);

  const handleCreateApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.applicantName.trim() || !formData.guardianPhone.trim()) {
      alert(isBn ? 'অনুগ্রহ করে আবেদনকারীর নাম ও অভিভাবকের ফোন নম্বর প্রদান করুন।' : 'Please enter applicant name and phone number.');
      return;
    }

    const currentYear = new Date().getFullYear();
    const newApp: AdmissionApplication = {
      id: `app-${Date.now()}`,
      applicationNo: `ADM-${currentYear}-${String(applications.length + 1).padStart(3, '0')}`,
      applicantName: formData.applicantName.trim(),
      applicantNameBn: formData.applicantNameBn.trim() || formData.applicantName.trim(),
      gender: formData.gender,
      dateOfBirth: formData.dateOfBirth || new Date().toISOString().split('T')[0],
      desiredClass: formData.desiredClass || classes[0]?.name || '',
      fatherName: formData.fatherName.trim(),
      fatherNameBn: formData.fatherNameBn.trim() || formData.fatherName.trim(),
      motherName: formData.motherName.trim(),
      guardianPhone: formData.guardianPhone.trim(),
      guardianEmail: formData.guardianEmail.trim(),
      previousSchool: formData.previousSchool.trim(),
      address: formData.address.trim(),
      appliedDate: new Date().toISOString().split('T')[0],
      status: 'PENDING',
      notes: formData.notes.trim()
    };

    setApplications(prev => [newApp, ...prev]);
    setIsAddModalOpen(false);
    setFormData({
      applicantName: '',
      applicantNameBn: '',
      gender: 'male',
      dateOfBirth: '',
      desiredClass: classes[0]?.name || '',
      fatherName: '',
      fatherNameBn: '',
      motherName: '',
      guardianPhone: '',
      guardianEmail: '',
      previousSchool: '',
      address: '',
      notes: ''
    });
  };

  const handleApproveAndEnroll = (app: AdmissionApplication) => {
    // 1. Add as active enrolled student
    const currentYear = new Date().getFullYear();
    const autoStudentId = `${currentYear}${Math.floor(100 + Math.random() * 900)}`;

    addStudent({
      name: app.applicantName,
      nameBn: app.applicantNameBn || app.applicantName,
      gender: app.gender,
      dateOfBirth: app.dateOfBirth,
      classLevel: app.desiredClass,
      studentId: autoStudentId,
      roll: '১',
      rollNumber: '১',
      fatherName: app.fatherName,
      fatherNameBn: app.fatherNameBn || app.fatherName,
      motherName: app.motherName,
      guardianName: app.fatherNameBn || app.fatherName || 'অভিভাবক',
      guardianPhone: app.guardianPhone,
      guardianEmail: app.guardianEmail || '',
      address: app.address,
      admissionDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      isFormer: false
    });

    // 2. Mark application status as APPROVED
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'APPROVED' } : a));

    if (onEnrollStudent) {
      onEnrollStudent(app);
    }

    alert(isBn 
      ? `অভিনন্দন! "${app.applicantNameBn || app.applicantName}" সফলভাবে শিক্ষার্থী হিসেবে ভর্তি হয়েছেন (আইডি: ${autoStudentId})।`
      : `Success! "${app.applicantName}" has been successfully enrolled as a student (ID: ${autoStudentId}).`
    );
  };

  const handleReject = (appId: string) => {
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'REJECTED' } : a));
  };

  // Filtered applications
  const filteredApps = applications.filter(app => {
    const matchesStatus = filterStatus === 'ALL' || app.status === filterStatus;
    const matchesClass = filterClass === 'All' || app.desiredClass === filterClass;
    const q = searchTerm.toLowerCase().trim();
    if (!q) return matchesStatus && matchesClass;

    const matchesSearch = 
      app.applicantName.toLowerCase().includes(q) ||
      (app.applicantNameBn && app.applicantNameBn.includes(q)) ||
      app.applicationNo.toLowerCase().includes(q) ||
      app.guardianPhone.includes(q) ||
      app.fatherName.toLowerCase().includes(q);

    return matchesStatus && matchesClass && matchesSearch;
  });

  const pendingCount = applications.filter(a => a.status === 'PENDING').length;
  const approvedCount = applications.filter(a => a.status === 'APPROVED').length;
  const rejectedCount = applications.filter(a => a.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      
      {/* KPI Stats Strip for Admission */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase">{isBn ? 'মোট ভর্তি আবেদন' : 'Total Applications'}</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{formatNumber(applications.length, language)}</p>
          <span className="text-[11px] text-teal-600 font-semibold">{isBn ? 'চলতি শিক্ষাবর্ষ' : 'Current Session'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs bg-amber-50/30">
          <p className="text-xs font-bold text-amber-700 uppercase">{isBn ? 'অপেক্ষমাণ আবেদন' : 'Pending'}</p>
          <p className="text-2xl font-black text-amber-900 mt-1">{formatNumber(pendingCount, language)}</p>
          <span className="text-[11px] text-amber-700 font-semibold">{isBn ? 'যাচাই ও সিদ্ধান্ত বাকি' : 'Needs Verification'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs bg-emerald-50/30">
          <p className="text-xs font-bold text-emerald-700 uppercase">{isBn ? 'অনুমোদিত ও ভর্তি সম্পন্ন' : 'Enrolled / Approved'}</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">{formatNumber(approvedCount, language)}</p>
          <span className="text-[11px] text-emerald-700 font-semibold">{isBn ? 'সরাসরি শিক্ষার্থী হয়েছে' : 'Active Students'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-2xs bg-rose-50/30">
          <p className="text-xs font-bold text-rose-700 uppercase">{isBn ? 'বাতিলকৃত' : 'Rejected'}</p>
          <p className="text-2xl font-black text-rose-900 mt-1">{formatNumber(rejectedCount, language)}</p>
          <span className="text-[11px] text-rose-700 font-semibold">{isBn ? 'অযোগ্য বা বাতিল' : 'Not Eligible'}</span>
        </div>
      </div>

      {/* Action Header & Search */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isBn ? 'আবেদন নং, প্রার্থীর নাম বা মোবাইল দিয়ে খুঁজুন...' : 'Search by application no, name, phone...'}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="w-40 shrink-0">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
            >
              <option value="All">{isBn ? 'সকল শ্রেণি' : 'All Classes'}</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-36 shrink-0">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">{isBn ? 'সকল অবস্থা' : 'All Status'}</option>
              <option value="PENDING">{isBn ? 'অপেক্ষমাণ' : 'Pending'}</option>
              <option value="APPROVED">{isBn ? 'অনুমোদিত' : 'Approved'}</option>
              <option value="REJECTED">{isBn ? 'বাতিল' : 'Rejected'}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-2 font-bold shadow-xs"
          >
            <Plus size={16} />
            <span>{isBn ? 'নতুন আবেদন গ্রহণ' : 'New Application'}</span>
          </Button>
          <Button 
            variant="secondary"
            onClick={() => window.print()}
            className="flex items-center gap-2 text-xs font-bold"
          >
            <Printer size={16} />
            <span>{isBn ? 'তালিকা প্রিন্ট' : 'Print List'}</span>
          </Button>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">{isBn ? 'আবেদন নং' : 'App No'}</th>
                <th className="py-3 px-4">{isBn ? 'প্রার্থীর নাম ও তথ্য' : 'Applicant'}</th>
                <th className="py-3 px-4">{isBn ? 'আবেদিত শ্রেণি' : 'Desired Class'}</th>
                <th className="py-3 px-4">{isBn ? 'পিতা ও অভিভাবক' : 'Guardian'}</th>
                <th className="py-3 px-4">{isBn ? 'মোবাইল নম্বর' : 'Phone'}</th>
                <th className="py-3 px-4">{isBn ? 'আবেদনের তারিখ' : 'Date'}</th>
                <th className="py-3 px-4 text-center">{isBn ? 'অবস্থা' : 'Status'}</th>
                <th className="py-3 px-4 text-right">{isBn ? 'অ্যাকশন' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>{isBn ? 'কোনো ভর্তি আবেদন পাওয়া যায়নি।' : 'No admission applications found.'}</p>
                  </td>
                </tr>
              ) : (
                filteredApps.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-teal-800">
                      {app.applicationNo}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{app.applicantNameBn || app.applicantName}</div>
                      <div className="text-[11px] text-slate-400">{app.applicantName} • {app.gender === 'male' ? 'ছাত্র' : 'ছাত্রী'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold">
                        {app.desiredClass}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-semibold">{app.fatherNameBn || app.fatherName}</div>
                      <div className="text-[11px] text-slate-500">{app.address ? `${app.address.slice(0, 20)}...` : '—'}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      <a href={`tel:${app.guardianPhone}`} className="hover:text-teal-700 flex items-center gap-1">
                        <Phone size={13} className="text-teal-600" />
                        <span>{app.guardianPhone}</span>
                      </a>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatSafeDate(app.appliedDate, isBn)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {app.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock size={12} />
                          <span>{isBn ? 'অপেক্ষমাণ' : 'Pending'}</span>
                        </span>
                      )}
                      {app.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          <span>{isBn ? 'ভর্তি সম্পন্ন' : 'Enrolled'}</span>
                        </span>
                      )}
                      {app.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <XCircle size={12} />
                          <span>{isBn ? 'বাতিল' : 'Rejected'}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {app.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApproveAndEnroll(app)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                            title={isBn ? 'অনুমোদন দিয়ে সরাসরি শিক্ষার্থী হিসেবে ভর্তি করুন' : 'Approve & Enroll as Active Student'}
                          >
                            <UserCheck size={13} />
                            <span>{isBn ? 'ভর্তি অনুমোদন' : 'Enroll'}</span>
                          </button>
                          <button
                            onClick={() => handleReject(app.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer"
                            title={isBn ? 'বাতিল করুন' : 'Reject'}
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-semibold">{isBn ? 'কার্যকর হয়েছে' : 'Processed'}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intake Modal for New Walk-in / Manual Application */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-800 to-emerald-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl">
                  <Plus size={20} className="text-teal-200" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{isBn ? 'নতুন ভর্তি আবেদন ফরম' : 'New Admission Intake Form'}</h3>
                  <p className="text-xs text-teal-200">{isBn ? 'আবেদনকারীর তথ্য পূরণ করে সংরক্ষণ করুন' : 'Fill applicant details'}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 hover:bg-white/15 rounded-lg text-teal-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 block mb-1">{isBn ? 'প্রার্থীর নাম (বাংলায়) *' : 'Applicant Name (BN) *'}</label>
                  <input 
                    type="text" 
                    required
                    value={formData.applicantNameBn}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicantNameBn: e.target.value }))}
                    placeholder="আব্দুল্লাহ আল মাহমুদ"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">{isBn ? 'প্রার্থীর নাম (English) *' : 'Applicant Name (EN) *'}</label>
                  <input 
                    type="text" 
                    required
                    value={formData.applicantName}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicantName: e.target.value }))}
                    placeholder="Abdullah Al Mahmud"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">{isBn ? 'আবেদিত শ্রেণি *' : 'Desired Class *'}</label>
                  <select
                    value={formData.desiredClass}
                    onChange={(e) => setFormData(prev => ({ ...prev, desiredClass: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">{isBn ? 'লিঙ্গ' : 'Gender'}</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="male">{isBn ? 'ছাত্র (Male)' : 'Male'}</option>
                    <option value="female">{isBn ? 'ছাত্রী (Female)' : 'Female'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">{isBn ? 'পিতার নাম' : "Father's Name"}</label>
                  <input 
                    type="text"
                    value={formData.fatherNameBn}
                    onChange={(e) => setFormData(prev => ({ ...prev, fatherNameBn: e.target.value, fatherName: e.target.value }))}
                    placeholder="পিতার নাম"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">{isBn ? 'মাতার নাম' : "Mother's Name"}</label>
                  <input 
                    type="text"
                    value={formData.motherName}
                    onChange={(e) => setFormData(prev => ({ ...prev, motherName: e.target.value }))}
                    placeholder="মাতার নাম"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">{isBn ? 'অভিভাবকের মোবাইল নম্বর *' : 'Guardian Phone *'}</label>
                  <input 
                    type="tel"
                    required
                    value={formData.guardianPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, guardianPhone: e.target.value }))}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">{isBn ? 'পূর্ববর্তী মাদ্রাসা / স্কুল' : 'Previous School'}</label>
                  <input 
                    type="text"
                    value={formData.previousSchool}
                    onChange={(e) => setFormData(prev => ({ ...prev, previousSchool: e.target.value }))}
                    placeholder="নূরানী মাদ্রাসা..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">{isBn ? 'স্থায়ী ঠিকানা' : 'Address'}</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="গ্রাম, ডাকঘর, উপজেলা, জেলা..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                  {isBn ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white font-bold">
                  {isBn ? 'আবেদন সংরক্ষণ করুন' : 'Save Application'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
