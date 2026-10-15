import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Student } from '../../types';
import { formatNumber } from '../../services/utils';
import { Button } from '../ui/Button';
import { 
  Users, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  MapPin, 
  User, 
  MessageSquare, 
  Printer, 
  ShieldAlert, 
  CheckCircle2,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';

export const GuardianDirectoryView: React.FC<{
  onSelectStudent?: (student: Student) => void;
}> = ({ onSelectStudent }) => {
  const { students = [], classes = [], language } = useApp();
  const isBn = language === 'bn';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Active enrolled students
  const activeStudents = useMemo(() => {
    return students.filter(s => !s.isFormer && s.status !== 'Former');
  }, [students]);

  // Filtered list
  const filteredList = useMemo(() => {
    return activeStudents.filter(s => {
      const matchesClass = filterClass === 'All' || s.classLevel === filterClass;
      if (!searchTerm.trim()) return matchesClass;

      const q = searchTerm.toLowerCase().trim();
      return matchesClass && (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.nameBn && s.nameBn.includes(q)) ||
        (s.guardianName && s.guardianName.toLowerCase().includes(q)) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(q)) ||
        (s.fatherNameBn && s.fatherNameBn.includes(q)) ||
        (s.motherName && s.motherName.toLowerCase().includes(q)) ||
        (s.guardianPhone && s.guardianPhone.includes(q)) ||
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
      );
    });
  }, [activeStudents, filterClass, searchTerm]);

  const handleCopyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Distinct phone count (families count)
  const uniquePhonesCount = useMemo(() => {
    const phones = new Set(activeStudents.map(s => s.guardianPhone).filter(Boolean));
    return phones.size;
  }, [activeStudents]);

  return (
    <div className="space-y-6">
      
      {/* Top Guardian Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase">{isBn ? 'মোট অভিভাবক রেকর্ড' : 'Guardian Records'}</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{formatNumber(activeStudents.length, language)}</p>
          <span className="text-[11px] text-teal-600 font-semibold">{isBn ? 'সক্রিয় শিক্ষার্থী ভিত্তিক' : 'Active Students'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-teal-200 shadow-2xs bg-teal-50/30">
          <p className="text-xs font-bold text-teal-700 uppercase">{isBn ? 'স্বতন্ত্র পরিবার / মোবাইল' : 'Unique Families'}</p>
          <p className="text-2xl font-black text-teal-900 mt-1">{formatNumber(uniquePhonesCount, language)}</p>
          <span className="text-[11px] text-teal-700 font-semibold">{isBn ? 'স্বতন্ত্র অভিভাবক যোগাযোগ' : 'Distinct Contacts'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs bg-emerald-50/30">
          <p className="text-xs font-bold text-emerald-700 uppercase">{isBn ? 'মোবাইল নম্বর অন্তর্ভুক্ত' : 'Valid Phones'}</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">
            {formatNumber(activeStudents.filter(s => s.guardianPhone?.trim()).length, language)}
          </p>
          <span className="text-[11px] text-emerald-700 font-semibold">{isBn ? 'এসএমএস ও কলের জন্য প্রস্তুত' : 'Ready for SMS/Call'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs bg-amber-50/30">
          <p className="text-xs font-bold text-amber-700 uppercase">{isBn ? 'ফোন নম্বর বিহীন' : 'Missing Phone'}</p>
          <p className="text-2xl font-black text-amber-900 mt-1">
            {formatNumber(activeStudents.filter(s => !s.guardianPhone?.trim()).length, language)}
          </p>
          <span className="text-[11px] text-amber-700 font-semibold">{isBn ? 'তথ্য হালনাগাদ প্রয়োজন' : 'Needs Update'}</span>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isBn ? 'অভিভাবকের নাম, পিতা, মাতা, শিক্ষার্থীর নাম বা ফোন নম্বর দিয়ে খুঁজুন...' : 'Search guardian, parent, student name or phone...'}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="w-48 shrink-0">
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
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="secondary"
            onClick={handlePrint}
            className="flex items-center gap-2 text-xs font-bold shadow-2xs"
          >
            <Printer size={16} />
            <span>{isBn ? 'অভিভাবক তালিকা প্রিন্ট' : 'Print List'}</span>
          </Button>
        </div>
      </div>

      {/* Guardians Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">{isBn ? 'শিক্ষার্থী ও শ্রেণি' : 'Student & Class'}</th>
                <th className="py-3.5 px-4">{isBn ? 'পিতার নাম' : "Father's Name"}</th>
                <th className="py-3.5 px-4">{isBn ? 'মাতার নাম' : "Mother's Name"}</th>
                <th className="py-3.5 px-4">{isBn ? 'প্রাথমিক অভিভাবক' : 'Primary Guardian'}</th>
                <th className="py-3.5 px-4">{isBn ? 'জরুরি মোবাইল' : 'Contact Phone'}</th>
                <th className="py-3.5 px-4">{isBn ? 'ঠিকানা' : 'Address'}</th>
                <th className="py-3.5 px-4 text-right">{isBn ? 'দ্রুত যোগাযোগ' : 'Quick Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>{isBn ? 'কোনো অভিভাবক পাওয়া যায়নি।' : 'No guardians found.'}</p>
                  </td>
                </tr>
              ) : (
                filteredList.map(s => {
                  const hasPhone = Boolean(s.guardianPhone?.trim());
                  const cleanPhone = (s.guardianPhone || '').replace(/\s+/g, '');

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{s.nameBn || s.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          শ্রেণি: <span className="text-teal-800 font-bold">{s.classLevel}</span> • রোল: <span className="font-mono">{s.roll || s.rollNumber || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-semibold">{s.fatherNameBn || s.fatherName || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700">{s.motherNameBn || s.motherName || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-teal-900">{s.guardianName || s.fatherNameBn || s.fatherName || 'পিতা'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {hasPhone ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800">{s.guardianPhone}</span>
                            <button
                              onClick={() => handleCopyPhone(s.guardianPhone!)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 transition cursor-pointer"
                              title={isBn ? 'নম্বর কপি করুন' : 'Copy number'}
                            >
                              {copiedPhone === s.guardianPhone ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-rose-500 font-semibold text-[11px]">{isBn ? 'মোবাইল নেই' : 'No Phone'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={s.address}>
                        {s.address || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasPhone ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={`tel:${cleanPhone}`}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 transition flex items-center gap-1"
                              title={isBn ? 'সরাসরি কল দিন' : 'Call'}
                            >
                              <Phone size={12} className="text-emerald-700" />
                              <span>{isBn ? 'কল' : 'Call'}</span>
                            </a>
                            <a
                              href={`https://wa.me/88${cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold border border-teal-200 transition flex items-center gap-1"
                              title="WhatsApp"
                            >
                              <MessageSquare size={12} className="text-teal-700" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
