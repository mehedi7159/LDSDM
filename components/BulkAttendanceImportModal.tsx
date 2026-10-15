import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Student, Exam, RemarkRecord } from '../types';
import { 
  FileSpreadsheet, 
  Upload, 
  Clipboard, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  X, 
  Sparkles, 
  Users, 
  RefreshCw, 
  Check, 
  HelpCircle,
  FileText,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Button } from './ui/Button';
import { formatNumber } from '../services/utils';

interface BulkAttendanceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClass: string;
  selectedExamId: string;
  onImportSuccess?: (importedCount: number) => void;
}

interface ParsedAttendanceRow {
  key: string;
  rawIdentifier: string;
  student?: Student;
  workingDays?: number;
  totalPresent?: number;
  totalAbsent?: number;
  remark?: string;
  status: 'matched' | 'unmatched' | 'invalid';
  errorMessage?: string;
}

export const BulkAttendanceImportModal: React.FC<BulkAttendanceImportModalProps> = ({
  isOpen,
  onClose,
  selectedClass,
  selectedExamId,
  onImportSuccess
}) => {
  const { students = [], exams = [], remarks = [], updateRemark, language } = useApp();

  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'quick_preset'>('paste');
  const [pastedText, setPastedText] = useState<string>('');
  const [commonWorkingDays, setCommonWorkingDays] = useState<number | string>(24);
  const [commonRemark, setCommonRemark] = useState<string>('সন্তোষজনক');
  const [parsedRows, setParsedRows] = useState<ParsedAttendanceRow[]>([]);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId);
  }, [exams, selectedExamId]);

  // Class active students
  const classStudents = useMemo(() => {
    return students
      .filter(s => s.classLevel === selectedClass && s.status === 'Active' && !s.isFormer)
      .sort((a, b) => {
        const rollA = parseInt(a.roll || '0', 10);
        const rollB = parseInt(b.roll || '0', 10);
        if (!isNaN(rollA) && !isNaN(rollB) && rollA !== rollB) return rollA - rollB;
        return a.name.localeCompare(b.name);
      });
  }, [students, selectedClass]);

  if (!isOpen) return null;

  // Helper to match row to student
  const findStudent = (identifier: string): Student | undefined => {
    if (!identifier) return undefined;
    const clean = identifier.trim().toLowerCase();
    
    // Match by studentId
    let found = classStudents.find(s => s.studentId && s.studentId.toLowerCase() === clean);
    if (found) return found;

    // Match by roll
    found = classStudents.find(s => s.roll != null && String(s.roll).toLowerCase() === clean);
    if (found) return found;

    // Match by exact name
    found = classStudents.find(s => s.name.toLowerCase() === clean || (s.nameBn && s.nameBn.toLowerCase() === clean));
    if (found) return found;

    // Match partial numeric ID
    const num = parseInt(clean, 10);
    if (!isNaN(num)) {
      found = classStudents.find(s => {
        const sRoll = parseInt(s.roll || '-1', 10);
        const sId = parseInt(s.studentId || '-1', 10);
        return sRoll === num || sId === num;
      });
    }

    return found;
  };

  // Parse pasted or file content
  const handleParseContent = (text: string) => {
    setPastedText(text);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    const rows: ParsedAttendanceRow[] = [];

    lines.forEach((line, idx) => {
      if (!line.trim()) return;

      // Split by tab (Excel/Sheets copy-paste), comma (CSV), or multiple spaces
      let cols: string[] = [];
      if (line.includes('\t')) {
        cols = line.split('\t').map(c => c.trim());
      } else if (line.includes(',')) {
        cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      } else {
        cols = line.split(/\s{2,}|\s+/).map(c => c.trim());
      }

      // Skip header row if contains words like Roll, ID, Name, Working, Present
      const firstColLower = (cols[0] || '').toLowerCase();
      if (
        (firstColLower.includes('roll') || firstColLower.includes('id') || firstColLower.includes('student') || firstColLower.includes('নাম')) &&
        idx === 0
      ) {
        return;
      }

      const rawIdentifier = cols[0] || '';
      const student = findStudent(rawIdentifier) || (cols[1] ? findStudent(cols[1]) : undefined);

      // Extract values:
      // Pattern 1: ID/Roll, Present, Absent, WorkingDays, Remark
      // Pattern 2: Roll, Name, WorkingDays, Present, Absent, Remark
      let workingDays: number | undefined;
      let totalPresent: number | undefined;
      let totalAbsent: number | undefined;
      let remark: string | undefined;

      const numCols = cols.map(c => {
        const n = parseFloat(c.replace(/[^\d.]/g, ''));
        return isNaN(n) ? null : n;
      });

      // Filter numeric columns
      const validNumbers = numCols.filter(n => n !== null) as number[];

      if (cols.length >= 4) {
        // If 2nd column is student name string and subsequent are numbers
        if (isNaN(Number(cols[1])) && validNumbers.length >= 2) {
          workingDays = validNumbers[0];
          totalPresent = validNumbers[1];
          totalAbsent = validNumbers[2] !== undefined ? validNumbers[2] : (workingDays !== undefined && totalPresent !== undefined ? Math.max(0, workingDays - totalPresent) : undefined);
          remark = cols.slice(4).join(' ').trim() || undefined;
        } else {
          // 0: ID, 1: WorkingDays, 2: Present, 3: Absent, 4: Remark
          workingDays = numCols[1] ?? undefined;
          totalPresent = numCols[2] ?? undefined;
          totalAbsent = numCols[3] ?? (workingDays !== undefined && totalPresent !== undefined ? Math.max(0, workingDays - totalPresent) : undefined);
          remark = cols.slice(4).join(' ').trim() || undefined;
        }
      } else if (cols.length === 3) {
        // ID, Present, WorkingDays
        totalPresent = numCols[1] ?? undefined;
        workingDays = numCols[2] ?? undefined;
        if (workingDays !== undefined && totalPresent !== undefined) {
          totalAbsent = Math.max(0, workingDays - totalPresent);
        }
      } else if (cols.length === 2) {
        // ID, Present Days (Assumes current common working days)
        totalPresent = numCols[1] ?? undefined;
        const wDays = Number(commonWorkingDays) || 24;
        workingDays = wDays;
        if (totalPresent !== undefined) {
          totalAbsent = Math.max(0, wDays - totalPresent);
        }
      }

      let status: 'matched' | 'unmatched' | 'invalid' = 'matched';
      let errorMessage: string | undefined;

      if (!student) {
        status = 'unmatched';
        errorMessage = language === 'bn' ? 'শিক্ষার্থী শনাক্ত করা যায়নি' : 'Student not recognized';
      } else if (totalPresent !== undefined && workingDays !== undefined && totalPresent > workingDays) {
        status = 'invalid';
        errorMessage = language === 'bn' ? 'উপস্থিতি কর্মদিবসের চেয়ে বেশি' : 'Present exceeds working days';
      }

      rows.push({
        key: `row_${idx}_${rawIdentifier}`,
        rawIdentifier,
        student,
        workingDays,
        totalPresent,
        totalAbsent,
        remark,
        status,
        errorMessage
      });
    });

    setParsedRows(rows);
  };

  // Generate Quick Preset for All Class Students
  const handleGenerateQuickPreset = () => {
    const wDays = Number(commonWorkingDays) || 24;
    const rows: ParsedAttendanceRow[] = classStudents.map((student, idx) => {
      const existing = remarks.find(r => r.studentId === student.id && r.examId === selectedExamId);
      return {
        key: `preset_${student.id}`,
        rawIdentifier: student.studentId || student.roll || student.name,
        student,
        workingDays: wDays,
        totalPresent: existing?.totalPresent !== undefined ? existing.totalPresent : wDays,
        totalAbsent: existing?.totalAbsent !== undefined ? existing.totalAbsent : 0,
        remark: existing?.remark || commonRemark,
        status: 'matched'
      };
    });

    setParsedRows(rows);
    setActiveTab('quick_preset');
  };

  // Handle File Upload (.csv or .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleParseContent(text);
      }
    };
    reader.readAsText(file);
  };

  // Download Sample CSV template
  const handleDownloadSampleCsv = () => {
    let csv = 'Student_ID_Or_Roll,Student_Name,Working_Days,Total_Present,Total_Absent,Remark\n';
    classStudents.slice(0, 10).forEach((s, idx) => {
      const idOrRoll = s.studentId || s.roll || (idx + 1).toString();
      csv += `"${idOrRoll}","${s.name}",24,22,2,"নিয়মিত ও সন্তোষজনক"\n`;
    });

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_Import_Template_${selectedClass}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Commit all parsed attendance rows to state & Firestore
  const handleApplyImport = async () => {
    const validRows = parsedRows.filter(r => r.status === 'matched' && r.student);
    if (validRows.length === 0) return;

    setIsApplying(true);
    setSuccessNotice(null);

    try {
      validRows.forEach(row => {
        if (!row.student) return;
        updateRemark(row.student.id, selectedExamId, {
          workingDays: row.workingDays,
          totalPresent: row.totalPresent,
          totalAbsent: row.totalAbsent !== undefined ? row.totalAbsent : (row.workingDays !== undefined && row.totalPresent !== undefined ? Math.max(0, row.workingDays - row.totalPresent) : undefined),
          remark: row.remark || ''
        });
      });

      setSuccessNotice(
        language === 'bn'
          ? `আলহামদুলিল্লাহ! ${validRows.length} জন শিক্ষার্থীর হাজিরা ও মন্তব্য সফলভাবে ইমপোর্ট এবং সংরক্ষণ করা হয়েছে।`
          : `Successfully imported attendance & remarks for ${validRows.length} students!`
      );

      if (onImportSuccess) {
        onImportSuccess(validRows.length);
      }

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Attendance import error:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const matchedCount = parsedRows.filter(r => r.status === 'matched').length;
  const unmatchedCount = parsedRows.filter(r => r.status === 'unmatched').length;
  const invalidCount = parsedRows.filter(r => r.status === 'invalid').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-400 shadow-md">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {language === 'bn' ? 'বাল্ক হাজিরা ও মন্তব্য ইমপোর্ট' : 'Bulk Attendance & Remarks Import'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-300 text-[10px] font-bold border border-indigo-400/30">
                  {selectedClass} • {selectedExam?.name}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {language === 'bn' 
                  ? 'এক্সেলে তৈরি হাজিরা শিট কপি-পেস্ট বা আপলোড করে এক ক্লিকে পুরো ক্লাসের হাজিরা যুক্ত করুন' 
                  : 'Paste or upload daily working days, presence, and remarks for the entire class at once'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clipboard size={14} />
            <span>{language === 'bn' ? 'কপি-পেস্ট ইমপোর্ট' : 'Paste Sheet Data'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload size={14} />
            <span>{language === 'bn' ? 'CSV / ফাইল আপলোড' : 'Upload CSV File'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('quick_preset');
              if (parsedRows.length === 0) handleGenerateQuickPreset();
            }}
            className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'quick_preset'
                ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap size={14} className="text-amber-500" />
            <span>{language === 'bn' ? 'দ্রুত অটো-ফিল প্রিসেট' : 'Quick Class Preset'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Success Notice */}
          {successNotice && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
              <div className="text-xs font-bold">{successNotice}</div>
            </div>
          )}

          {/* Paste Tab */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    {language === 'bn' ? 'এক্সেল বা গুগল শিট থেকে ডাটা পেস্ট করুন' : 'Paste from Excel or Google Sheets'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {language === 'bn' 
                      ? 'কলাম ফরম্যাট: [রোল/আইডি] [কর্মদিবস] [উপস্থিতি] [অনুপস্থিতি] [মন্তব্য]' 
                      : 'Supported formats: [Roll/ID] [Working Days] [Present] [Absent] [Remarks]'}
                  </p>
                </div>

                <Button
                  variant="secondary"
                  onClick={handleDownloadSampleCsv}
                  className="text-xs flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 py-1.5"
                >
                  <Download size={13} />
                  <span>{language === 'bn' ? 'স্যাম্পল টেমপ্লেট' : 'Sample CSV'}</span>
                </Button>
              </div>

              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => handleParseContent(e.target.value)}
                placeholder={`1\t24\t22\t2\tনিয়মিত ও সন্তোষজনক\n2\t24\t20\t4\tআরও মনোযোগী হতে হবে\n3\t24\t24\t0\tচমৎকার উপস্থিতি`}
                className="w-full p-3.5 text-xs font-mono border border-slate-300 rounded-2xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <HelpCircle size={13} className="text-indigo-600" />
                  <span>এক্সেলের যেকোনো সারি কপি করে এখানে পেস্ট করলেই তা স্বয়ংক্রিয়ভাবে প্রসেস হবে।</span>
                </span>
                {pastedText && (
                  <button
                    type="button"
                    onClick={() => handleParseContent('')}
                    className="text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    {language === 'bn' ? 'ডাটা মুছুন' : 'Clear Text'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-3xl text-center cursor-pointer transition-all hover:bg-indigo-50/70"
              >
                <Upload size={36} className="mx-auto text-indigo-600 mb-2" />
                <h4 className="text-sm font-bold text-slate-800">
                  {language === 'bn' ? 'CSV বা টেক্সট ফাইল আপলোড করতে ক্লিক করুন' : 'Click to upload Attendance CSV / Text file'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'bn' ? '.csv, .tsv বা .txt ফাইল সমর্থিত' : 'Supports .csv, .tsv or .txt files'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  onClick={handleDownloadSampleCsv}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>{language === 'bn' ? 'রেডিমেড স্যাম্পল CSV ডাউনলোড' : 'Download Sample CSV'}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Quick Preset Tab */}
          {activeTab === 'quick_preset' && (
            <div className="space-y-4 bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-amber-900 block">
                    {language === 'bn' ? 'এক ক্লিকে পুরো ক্লাসের ডিফল্ট হাজিরা তৈরি করুন' : 'Fast Auto-Fill Preset for All Students'}
                  </span>
                  <span className="text-[11px] text-amber-700 block">
                    {language === 'bn' ? 'সকল শিক্ষার্থীর জন্য একযোগে কর্মদিবস ও পূর্ণ উপস্থিতি সেট করে প্রয়োজনমতো এডিট করুন' : 'Set standard working days and full presence for all students with one click'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">মোট কর্মদিবস</label>
                    <input
                      type="number"
                      value={commonWorkingDays}
                      onChange={(e) => setCommonWorkingDays(e.target.value)}
                      className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white text-center font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">ডিফল্ট মন্তব্য</label>
                    <input
                      type="text"
                      value={commonRemark}
                      onChange={(e) => setCommonRemark(e.target.value)}
                      className="w-32 px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white font-bold"
                    />
                  </div>

                  <Button
                    onClick={handleGenerateQuickPreset}
                    className="mt-3.5 px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1"
                  >
                    <Sparkles size={13} />
                    <span>{language === 'bn' ? 'প্রিসেট রিফ্রেশ' : 'Apply Preset'}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Validation & Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    {language === 'bn' ? 'ইমপোর্ট প্রিভিউ ও যাচাই' : 'Import Preview & Validation'}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700">
                    মোট {parsedRows.length} টি সারি
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                    ✓ {matchedCount} {language === 'bn' ? 'ম্যাচড' : 'Matched'}
                  </span>
                  {unmatchedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[11px]">
                      ⚠️ {unmatchedCount} {language === 'bn' ? 'অজানা' : 'Unmatched'}
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
                      ⚠️ {invalidCount} {language === 'bn' ? 'ত্রুটিযুক্ত' : 'Invalid'}
                    </span>
                  )}
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5">রোল/আইডি</th>
                      <th className="p-2.5">শিক্ষার্থী</th>
                      <th className="p-2.5 text-center">মোট কর্মদিবস</th>
                      <th className="p-2.5 text-center">উপস্থিতি</th>
                      <th className="p-2.5 text-center">অনুপস্থিতি</th>
                      <th className="p-2.5">মন্তব্য</th>
                      <th className="p-2.5 text-center">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr 
                        key={row.key} 
                        className={
                          row.status === 'matched' 
                            ? 'hover:bg-slate-50' 
                            : row.status === 'unmatched' 
                            ? 'bg-rose-50/50' 
                            : 'bg-amber-50/50'
                        }
                      >
                        <td className="p-2.5 font-mono font-bold text-slate-700">
                          {row.rawIdentifier}
                        </td>
                        <td className="p-2.5">
                          {row.student ? (
                            <div>
                              <span className="font-bold text-slate-900 block">{row.student.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {row.student.studentId || row.student.roll}</span>
                            </div>
                          ) : (
                            <span className="text-rose-600 font-bold">{row.errorMessage || 'Unknown'}</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            value={row.workingDays ?? ''}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx].workingDays = e.target.value === '' ? undefined : Number(e.target.value);
                              if (next[idx].workingDays !== undefined && next[idx].totalPresent !== undefined) {
                                next[idx].totalAbsent = Math.max(0, next[idx].workingDays! - next[idx].totalPresent!);
                              }
                              setParsedRows(next);
                            }}
                            className="w-16 px-1.5 py-1 text-center border border-slate-300 rounded bg-white font-bold"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            value={row.totalPresent ?? ''}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx].totalPresent = e.target.value === '' ? undefined : Number(e.target.value);
                              if (next[idx].workingDays !== undefined && next[idx].totalPresent !== undefined) {
                                next[idx].totalAbsent = Math.max(0, next[idx].workingDays! - next[idx].totalPresent!);
                              }
                              setParsedRows(next);
                            }}
                            className="w-16 px-1.5 py-1 text-center border border-slate-300 rounded bg-white font-bold text-emerald-700"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            value={row.totalAbsent ?? ''}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx].totalAbsent = e.target.value === '' ? undefined : Number(e.target.value);
                              setParsedRows(next);
                            }}
                            className="w-16 px-1.5 py-1 text-center border border-slate-300 rounded bg-white font-bold text-rose-700"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={row.remark ?? ''}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx].remark = e.target.value;
                              setParsedRows(next);
                            }}
                            className="w-full px-2 py-1 border border-slate-300 rounded bg-white font-bangla text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          {row.status === 'matched' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              ✓ সঠিক
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              {row.errorMessage}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            {language === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>

          <Button
            type="button"
            onClick={handleApplyImport}
            disabled={isApplying || matchedCount === 0}
            className="px-6 py-2.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2"
          >
            {isApplying ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            <span>
              {isApplying
                ? (language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                : (language === 'bn' 
                    ? `সকল ${matchedCount} জনের হাজিরা চূড়ান্তভাবে ইমপোর্ট করুন` 
                    : `Apply & Save ${matchedCount} Attendance Records`)}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
