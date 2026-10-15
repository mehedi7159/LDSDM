import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Users, 
  BookOpen, 
  MessageSquare, 
  Calendar, 
  HelpCircle,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Info
} from 'lucide-react';
import { Exam, MarkRecord, RemarkRecord, Subject, SchoolClass } from '../types';
import { 
  inspectAndParseExamBackup, 
  executeExamRestore, 
  ExamBackupInspectionResult,
  ExecuteExamRestoreResult 
} from '../services/examBackupService';
import { formatNumber } from '../services/utils';

interface ExamRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: Exam[];
  marks: MarkRecord[];
  remarks: RemarkRecord[];
  subjects: Subject[];
  classes: SchoolClass[];
  language: string;
  onRestoreSuccess: (result: ExecuteExamRestoreResult) => void;
  t: (key: any) => string;
}

export const ExamRestoreModal: React.FC<ExamRestoreModalProps> = ({
  isOpen,
  onClose,
  exams,
  marks,
  remarks,
  subjects,
  classes,
  language,
  onRestoreSuccess,
  t
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [inspection, setInspection] = useState<ExamBackupInspectionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Restore Configuration States
  const [destinationChoice, setDestinationChoice] = useState<'detected' | 'existing' | 'new'>('detected');
  const [selectedExistingExamId, setSelectedExistingExamId] = useState<string>('');
  const [newExamName, setNewExamName] = useState<string>('');
  const [newExamYear, setNewExamYear] = useState<string>(new Date().getFullYear().toString());
  const [newExamCategory, setNewExamCategory] = useState<Exam['category']>('Term');
  
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [includeRemarks, setIncludeRemarks] = useState(true);
  const [includeSubjects, setIncludeSubjects] = useState(true);

  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreComplete, setRestoreComplete] = useState<ExecuteExamRestoreResult | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setInspection(null);
    setErrorMsg(null);
    setFileName('');
    setFileSize('');
    setDestinationChoice('detected');
    setSelectedExistingExamId(exams.length > 0 ? exams[0].id : '');
    setNewExamName('');
    setRestoreMode('replace');
    setIncludeRemarks(true);
    setIncludeSubjects(true);
    setIsRestoring(false);
    setRestoreComplete(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleProcessFile = (file: File) => {
    setErrorMsg(null);
    setRestoreComplete(null);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    if (!file.name.endsWith('.json')) {
      setErrorMsg(language === 'bn' ? 'অনুগ্রহ করে একটি .json ফাইল আপলোড করুন।' : 'Please upload a .json backup file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = inspectAndParseExamBackup(content);

      if (!result.isValid) {
        setErrorMsg(result.errorMessage || (language === 'bn' ? 'ফাইলটি সঠিকভাবে পড়া যায়নি।' : 'Failed to inspect file.'));
        setInspection(null);
        return;
      }

      setInspection(result);
      
      // Smart destination preselection
      if (result.detectedExamId && exams.some(e => e.id === result.detectedExamId)) {
        setDestinationChoice('detected');
      } else if (result.detectedExamName && exams.some(e => e.name.toLowerCase() === result.detectedExamName.toLowerCase())) {
        const matched = exams.find(e => e.name.toLowerCase() === result.detectedExamName.toLowerCase());
        setDestinationChoice('existing');
        if (matched) setSelectedExistingExamId(matched.id);
      } else {
        setDestinationChoice('detected');
        setNewExamName(result.detectedExamName || 'Restored Examination');
        setNewExamYear(result.academicYear || new Date().getFullYear().toString());
      }
    };

    reader.onerror = () => {
      setErrorMsg(language === 'bn' ? 'ফাইল পড়তে সমস্যা হয়েছে।' : 'Error reading file.');
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleExecuteRestore = () => {
    if (!inspection) return;

    let targetExamId = '';
    let targetExamDetails: Partial<Exam> | undefined;

    if (destinationChoice === 'detected') {
      targetExamId = inspection.detectedExamId || `exam_${Date.now()}`;
      targetExamDetails = {
        name: inspection.detectedExam?.name || inspection.detectedExamName || 'Restored Examination',
        nameBn: inspection.detectedExam?.nameBn || '',
        academicYear: inspection.detectedExam?.academicYear || inspection.academicYear || new Date().getFullYear().toString(),
        category: inspection.detectedExam?.category || 'Term'
      };
    } else if (destinationChoice === 'existing') {
      if (!selectedExistingExamId) {
        setErrorMsg(language === 'bn' ? 'অনুগ্রহ করে একটি বিদ্যমান পরীক্ষা নির্বাচন করুন।' : 'Please select an existing exam.');
        return;
      }
      targetExamId = selectedExistingExamId;
    } else if (destinationChoice === 'new') {
      if (!newExamName.trim()) {
        setErrorMsg(language === 'bn' ? 'পরীক্ষার নাম প্রদান করুন।' : 'Please enter an exam name.');
        return;
      }
      targetExamId = `exam_${Date.now()}`;
      targetExamDetails = {
        name: newExamName.trim(),
        academicYear: newExamYear.trim() || new Date().getFullYear().toString(),
        category: newExamCategory
      };
    }

    setIsRestoring(true);

    try {
      const result = executeExamRestore({
        inspection,
        targetExamId,
        targetExamDetails,
        restoreMode,
        includeRemarks,
        includeSubjects,
        currentExams: exams,
        currentMarks: marks,
        currentRemarks: remarks,
        currentSubjects: subjects,
        currentClasses: classes
      });

      setRestoreComplete(result);
      onRestoreSuccess(result);
    } catch (err: any) {
      setErrorMsg(err?.message || (language === 'bn' ? 'রিস্টোর করতে সমস্যা হয়েছে।' : 'Restore failed.'));
    } finally {
      setIsRestoring(false);
    }
  };

  // Target Exam summary
  const getTargetExamDisplayName = () => {
    if (destinationChoice === 'detected') {
      return inspection?.detectedExamName || 'Original Exam';
    }
    if (destinationChoice === 'existing') {
      const ex = exams.find(e => e.id === selectedExistingExamId);
      return ex?.name || 'Selected Exam';
    }
    return newExamName || 'New Exam';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-linear-to-r from-purple-600 to-indigo-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <RefreshCw size={20} className="text-purple-100" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                {language === 'bn' ? 'পরীক্ষাওয়ারী নম্বর রিস্টোর হাব' : 'Exam-wise Marks Restore Hub'}
              </h3>
              <p className="text-xs text-purple-200">
                {language === 'bn' 
                  ? 'নিরাপদে নির্দিষ্ট পরীক্ষার নম্বর যাচাই ও রিস্টোর করুন' 
                  : 'Safely inspect, map and restore marks for a specific exam'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Success Result View */}
          {restoreComplete ? (
            <div className="space-y-5 text-center py-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-800">
                  {language === 'bn' ? 'নম্বর সফলভাবে রিস্টোর হয়েছে!' : 'Exam Marks Restored Successfully!'}
                </h4>
                <p className="text-sm text-slate-500 mt-1">
                  {language === 'bn'
                    ? `পরীক্ষা: "${restoreComplete.stats.targetExamName}"-এর নম্বর সংরক্ষিত ও সিঙ্ক হয়েছে।`
                    : `Exam "${restoreComplete.stats.targetExamName}" marks have been safely applied and synced.`}
                </p>
              </div>

              {/* Stats Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-left">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                  <div className="text-xs text-slate-400 font-medium">{language === 'bn' ? 'মোট নম্বর এন্ট্রি' : 'Marks Records'}</div>
                  <div className="text-lg font-black text-purple-700 mt-0.5">
                    {formatNumber(restoreComplete.stats.restoredMarksCount, language)}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                  <div className="text-xs text-slate-400 font-medium">{language === 'bn' ? 'নতুন যুক্ত' : 'Inserted'}</div>
                  <div className="text-lg font-black text-emerald-600 mt-0.5">
                    {formatNumber(restoreComplete.stats.insertedMarksCount, language)}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                  <div className="text-xs text-slate-400 font-medium">{language === 'bn' ? 'প্রতিস্থাপিত' : 'Replaced'}</div>
                  <div className="text-lg font-black text-amber-600 mt-0.5">
                    {formatNumber(restoreComplete.stats.replacedMarksCount, language)}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                  <div className="text-xs text-slate-400 font-medium">{language === 'bn' ? 'মন্তব্য/উপস্থিতি' : 'Remarks'}</div>
                  <div className="text-lg font-black text-indigo-600 mt-0.5">
                    {formatNumber(restoreComplete.stats.restoredRemarksCount, language)}
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={handleClose}
                  className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all"
                >
                  {language === 'bn' ? 'সম্পন্ন (বন্ধ করুন)' : 'Done & Close'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Upload / Dropzone */}
              {!inspection ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                      dragOver 
                        ? 'border-purple-500 bg-purple-50/70 scale-[1.01]' 
                        : 'border-slate-300 hover:border-purple-400 hover:bg-slate-50/70'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept=".json" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                    <div className="w-14 h-14 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Upload size={28} />
                    </div>
                    <h4 className="font-bold text-slate-800 text-base">
                      {language === 'bn' ? 'ব্যাকআপ ফাইলটি এখানে ড্রপ করুন অথবা সিলেক্ট করুন' : 'Drop your exam backup file here or browse'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {language === 'bn' ? 'সাপোর্টেড ফরম্যাট: .JSON (পরীক্ষার ব্যাকআপ অথবা ফুল ব্যাকআপ)' : 'Supported format: .JSON (Exam-wise or full backup)'}
                    </p>
                    <button 
                      type="button" 
                      className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs pointer-events-none"
                    >
                      {language === 'bn' ? 'কম্পিউটার থেকে ফাইল বাছুন' : 'Select JSON File'}
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="p-3.5 bg-red-50 text-red-700 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">{language === 'bn' ? 'ত্রুটি:' : 'Error:'}</span> {errorMsg}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs text-slate-600 space-y-1.5">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      {language === 'bn' ? 'নিরাপদ রিস্টোর বৈশিষ্ট্য:' : 'Safety & Guarantee:'}
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
                      <li>{language === 'bn' ? 'অন্যান্য পরীক্ষার নম্বর ও ডাটা সম্পূর্ণ অক্ষত থাকবে।' : 'Marks for other exams will remain completely untouched.'}</li>
                      <li>{language === 'bn' ? 'ফাইল লোড হওয়ার পর প্রিভিউ ও কনফিগারেশনের সুযোগ পাবেন।' : 'You will see a full inspection & preview before committing.'}</li>
                      <li>{language === 'bn' ? 'প্রয়োজনে বিদ্যমান পরীক্ষার সাথে মার্জ বা নতুন পরীক্ষা তৈরি করা যাবে।' : 'You can map to existing exams or auto-create missing exams.'}</li>
                    </ul>
                  </div>
                </div>
              ) : (
                /* Step 2: Inspection & Configuration View */
                <div className="space-y-5">
                  
                  {/* Inspection File Header Badge */}
                  <div className="flex items-center justify-between p-4 bg-purple-50/70 rounded-2xl border border-purple-200/80">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-purple-600 text-white rounded-xl">
                        <FileCheck size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">{fileName}</span>
                          <span className="text-[10px] bg-purple-200 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                            {fileSize}
                          </span>
                        </div>
                        <p className="text-xs text-purple-700 font-medium mt-0.5">
                          {language === 'bn' ? 'পরীক্ষা সনাক্তকরণ:' : 'Detected Exam:'} <strong className="text-purple-900">{inspection.detectedExamName}</strong> ({inspection.academicYear})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setInspection(null); setFileName(''); }}
                      className="text-xs text-purple-700 hover:text-purple-950 font-bold underline cursor-pointer"
                    >
                      {language === 'bn' ? 'ভিন্ন ফাইল বাছুন' : 'Change File'}
                    </button>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
                      <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                        <Layers size={16} />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-semibold">{language === 'bn' ? 'নম্বর এন্ট্রি' : 'Marks'}</div>
                        <div className="text-base font-black text-slate-900">
                          {formatNumber(inspection.stats.totalMarks, language)}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                        <Users size={16} />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-semibold">{language === 'bn' ? 'শিক্ষার্থী' : 'Students'}</div>
                        <div className="text-base font-black text-slate-900">
                          {formatNumber(inspection.stats.totalStudents, language)}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                        <BookOpen size={16} />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-semibold">{language === 'bn' ? 'বিষয়' : 'Subjects'}</div>
                        <div className="text-base font-black text-slate-900">
                          {formatNumber(inspection.stats.totalSubjects, language)}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
                      <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                        <MessageSquare size={16} />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-semibold">{language === 'bn' ? 'মন্তব্য' : 'Remarks'}</div>
                        <div className="text-base font-black text-slate-900">
                          {formatNumber(inspection.stats.totalRemarks, language)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Destination Exam Mapping */}
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar size={15} className="text-purple-600" />
                      {language === 'bn' ? 'নম্বরগুলো কোন পরীক্ষায় রিস্টোর করবেন?' : 'Where do you want to restore these marks?'}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Option 1: Detected */}
                      <button
                        type="button"
                        onClick={() => setDestinationChoice('detected')}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                          destinationChoice === 'detected'
                            ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-400/20 text-purple-900'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">
                          {language === 'bn' ? 'সনাক্তকৃত পরীক্ষা' : 'Detected Exam'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-1">
                          {inspection.detectedExamName}
                        </div>
                      </button>

                      {/* Option 2: Map to existing */}
                      <button
                        type="button"
                        onClick={() => setDestinationChoice('existing')}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                          destinationChoice === 'existing'
                            ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-400/20 text-purple-900'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">
                          {language === 'bn' ? 'বিদ্যমান পরীক্ষায় মার্জ' : 'Existing Exam'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-1">
                          {exams.length} {language === 'bn' ? 'টি পরীক্ষা উপলব্ধ' : 'available'}
                        </div>
                      </button>

                      {/* Option 3: Create as new */}
                      <button
                        type="button"
                        onClick={() => setDestinationChoice('new')}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                          destinationChoice === 'new'
                            ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-400/20 text-purple-900'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1">
                          <PlusCircle size={13} className="text-purple-600" />
                          {language === 'bn' ? 'নতুন পরীক্ষা তৈরি' : 'Create New'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-1">
                          {language === 'bn' ? 'কাস্টম নাম দিন' : 'Custom Name'}
                        </div>
                      </button>
                    </div>

                    {/* Sub-inputs based on choice */}
                    {destinationChoice === 'existing' && (
                      <div className="pt-2 animate-in fade-in">
                        <select
                          value={selectedExistingExamId}
                          onChange={(e) => setSelectedExistingExamId(e.target.value)}
                          className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800"
                        >
                          {exams.map(e => (
                            <option key={e.id} value={e.id}>
                              {e.name} ({e.academicYear})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {destinationChoice === 'new' && (
                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600">
                            {language === 'bn' ? 'পরীক্ষার নাম' : 'Exam Name'}
                          </label>
                          <input
                            type="text"
                            value={newExamName}
                            onChange={(e) => setNewExamName(e.target.value)}
                            placeholder="e.g. 2nd Term Examination"
                            className="w-full text-xs font-medium p-2 rounded-xl border border-slate-300 bg-white text-slate-800 mt-0.5"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600">
                            {language === 'bn' ? 'শিক্ষাবর্ষ' : 'Academic Year'}
                          </label>
                          <input
                            type="text"
                            value={newExamYear}
                            onChange={(e) => setNewExamYear(e.target.value)}
                            placeholder="2024"
                            className="w-full text-xs font-medium p-2 rounded-xl border border-slate-300 bg-white text-slate-800 mt-0.5"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Restore Strategy & Flags */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-800">
                      {language === 'bn' ? 'রিস্টোর মোড ও অপশনসমূহ:' : 'Restore Strategy & Options:'}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        restoreMode === 'replace' ? 'bg-purple-50/70 border-purple-400' : 'bg-white border-slate-200'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'replace'}
                          onChange={() => setRestoreMode('replace')}
                          className="mt-0.5 text-purple-600"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {language === 'bn' ? 'ক্লিন প্রতিস্থাপন (সুপারিশকৃত)' : 'Clean Replace (Recommended)'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {language === 'bn' 
                              ? 'শুধুমাত্র এই পরীক্ষার পূর্বের সকল নম্বর মুছে নতুনগুলো সেভ করবে।' 
                              : 'Replaces previous marks for this exam only.'}
                          </div>
                        </div>
                      </label>

                      <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        restoreMode === 'merge' ? 'bg-purple-50/70 border-purple-400' : 'bg-white border-slate-200'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="mt-0.5 text-purple-600"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {language === 'bn' ? 'মার্জ মোড (Merge)' : 'Merge Mode'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {language === 'bn' 
                              ? 'বিদ্যমান শিক্ষার্থীর নম্বর আপডেট করবে এবং নতুন এন্ট্রি যুক্ত করবে।' 
                              : 'Updates matching records and appends missing entries.'}
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Secondary Toggles */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={includeRemarks}
                          onChange={(e) => setIncludeRemarks(e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span>{language === 'bn' ? 'শিক্ষার্থীর মন্তব্য ও উপস্থিতি ডাটা রিস্টোর করুন' : 'Restore student remarks and attendance records'}</span>
                      </label>

                      {inspection.subjects.length > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={includeSubjects}
                            onChange={(e) => setIncludeSubjects(e.target.checked)}
                            className="rounded text-purple-600"
                          />
                          <span>
                            {language === 'bn' 
                              ? `অনুপস্থিত বিষয় স্বয়ংক্রিয়ভাবে তৈরি করুন (${formatNumber(inspection.subjects.length, language)} টি বিষয় পাওয়া গেছে)` 
                              : `Auto-create missing subjects (${inspection.subjects.length} subjects found)`}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3.5 bg-red-50 text-red-700 border border-red-200 rounded-2xl flex items-start gap-2 text-xs">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <div>{errorMsg}</div>
                    </div>
                  )}

                  {/* Impact Summary Note */}
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200/80 flex items-center gap-2 text-xs">
                    <Info size={16} className="shrink-0 text-emerald-600" />
                    <div>
                      {language === 'bn' 
                        ? `লক্ষ্য পরীক্ষা: "${getTargetExamDisplayName()}"-এ ${formatNumber(inspection.stats.totalMarks, language)} টি নম্বর সংরক্ষিত হবে।` 
                        : `Target Exam: "${getTargetExamDisplayName()}" will receive ${inspection.stats.totalMarks} mark entries.`}
                    </div>
                  </div>

                  {/* Execution Action Bar */}
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      {language === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={isRestoring}
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          {language === 'bn' ? 'রিস্টোর হচ্ছে...' : 'Restoring...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          {language === 'bn' ? 'এখনই রিস্টোর নিশ্চিত করুন' : 'Confirm & Restore Now'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

      </div>
    </div>
  );
};
