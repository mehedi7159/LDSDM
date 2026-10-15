import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Edit2, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Unlock, 
  Phone, 
  Mail, 
  Sparkles,
  Search,
  BookOpen
} from 'lucide-react';
import { AppUser, UserRole } from '../types';
import { ConfirmDialog } from './ui/ConfirmDialog';

export const UserRoleManager: React.FC = () => {
  const { 
    users = [], 
    setUsers,
    updateAppUser, 
    deleteAppUser, 
    signUpUser, 
    classes = [], 
    subjects = [], 
    language,
    authUser,
    adminEmail,
    isSuperAdmin
  } = useApp();

  const safeUsers = Array.isArray(users) ? users : [];
  const isOwner = isSuperAdmin || (authUser?.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
  const ownerDisplayName = authUser?.displayName || (isOwner ? 'Mehedi Hasan Sagor' : (authUser?.email?.split('@')[0] || ''));

  const hasDemoUsers = safeUsers.some(u => 
    u.id.startsWith('user_teacher_') || 
    u.id.startsWith('user_acc_') || 
    u.id.startsWith('user_staff_') || 
    u.id.startsWith('user_guardian_') ||
    Boolean(u.email && u.email.includes('madrasha.local'))
  );

  const handleClearDemoUsers = () => {
    if (!confirm('আপনি কি নিশ্চিত যে সকল ডেমো (নমুনা) শিক্ষক ও কর্মচারীদের ডাটা মুছে ফেলতে চান? এতে শুধুমাত্র আপনার ওনার ও সুপার অ্যাডমিন অ্যাকাউন্ট বহাল থাকবে।')) {
      return;
    }
    const filtered = safeUsers.filter(u => 
      u.role === 'super_admin' || 
      (authUser?.email && u.email?.toLowerCase() === authUser.email.toLowerCase()) ||
      (authUser?.uid && u.id === authUser.uid)
    );
    setUsers(filtered);
    try {
      localStorage.setItem('madrasha_app_users', JSON.stringify(filtered));
    } catch (e) {}
    setNotification('সকল ডেমো অ্যাকাউন্ট মুছে ফেলা হয়েছে। এখন আপনি মাদ্রাসার প্রকৃত শিক্ষকদের তথ্য যোগ করতে পারেন।');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123');
  const [role, setRole] = useState<UserRole>('teacher');
  const [designation, setDesignation] = useState('');
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);

  const handleOpenAdd = () => {
    setName('');
    setNameBn('');
    setPhone('');
    setEmail('');
    setPassword('123');
    setRole('teacher');
    setDesignation('মুয়াল্লিম');
    setAssignedClasses([]);
    setEditingUser(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setName(user.name || '');
    setNameBn(user.nameBn || user.name || '');
    setPhone(user.phone || '');
    setEmail(user.email || '');
    setPassword(user.password || '123');
    setRole(user.role);
    setDesignation(user.designation || '');
    setAssignedClasses(user.assignedClasses || []);
    setShowAddModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('নাম ও মোবাইল নম্বর আবশ্যক।');
      return;
    }

    if (editingUser) {
      if (updateAppUser) {
        await updateAppUser({
          ...editingUser,
          name: name.trim(),
          nameBn: nameBn.trim() || name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          password: password.trim(),
          role,
          designation: designation.trim(),
          assignedClasses
        });
      }
      setNotification('ব্যবহারকারীর তথ্য সফলভাবে আপডেট হয়েছে!');
    } else {
      if (signUpUser) {
        const res = await signUpUser({
          name: name.trim(),
          nameBn: nameBn.trim() || name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          password: password.trim(),
          role,
          designation: designation.trim(),
          assignedClasses
        });
        if (!res.success) {
          alert(res.message);
          return;
        }
      }
      setNotification('নতুন ব্যবহারকারী সফলভাবে যুক্ত হয়েছে!');
    }

    setShowAddModal(false);
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleClassAssignment = (className: string) => {
    const list = assignedClasses || [];
    if (list.includes(className)) {
      setAssignedClasses(list.filter(c => c !== className));
    } else {
      setAssignedClasses([...list, className]);
    }
  };

  const executeDelete = async () => {
    if (!userToDelete) return;
    if (deleteAppUser) {
      await deleteAppUser(userToDelete.id);
    }
    setUserToDelete(null);
    setNotification('ব্যবহারকারী ডিলিট হয়েছে।');
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredUsers = safeUsers.filter(u => {
    if (!u) return false;
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query ||
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.nameBn && u.nameBn.includes(query)) ||
      (u.phone && u.phone.includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query));
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Authenticated Admin Account Card */}
      {authUser ? (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center font-black text-xl text-indigo-300 shrink-0">
              {(ownerDisplayName || authUser.email || 'M')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-black text-white">
                  {ownerDisplayName || 'Mehedi Hasan Sagor'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                  ✓ গুগল ভেরিফাইড ওনার
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5 font-mono">
                {authUser.email}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-indigo-300">
                <span className="px-2 py-0.5 rounded bg-white/10 font-bold">পদবী: প্রতিষ্ঠাতা ও সুপার অ্যাডমিন</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">পূর্ণ ক্লাউড নিয়ন্ত্রণ সক্রিয়</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasDemoUsers && (
              <button
                onClick={handleClearDemoUsers}
                className="px-3.5 py-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="সকল নমুনা (ডেমো) শিক্ষক ও কর্মচারীদের ডাটা মুছে ফেলুন"
              >
                <Trash2 size={14} />
                <span>ডেমো ইউজার ডাটা মুছুন</span>
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <UserPlus size={15} />
              <span>+ নতুন ইউজার যুক্ত করুন</span>
            </button>
          </div>
        </div>
      ) : (
        /* Header Banner when not signed in */
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                মাদ্রাসা ইউজার ও রোল পারমিশন ব্যবস্থাপনা
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                মুয়াল্লিম, স্টাফ, হিসাবরক্ষক ও অভিভাবকদের ইউজার আইডি, মোবাইল নম্বর ও পাসওয়ার্ড নিয়ন্ত্রণ করুন।
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-all shrink-0"
          >
            <UserPlus size={15} />
            <span>+ নতুন ইউজার যুক্ত করুন</span>
          </button>
        </div>
      )}

      {/* Demo Data Notice if demo users exist */}
      {hasDemoUsers && (
        <div className="p-4 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>
              <strong>নমুনা ডাটা নোটিশ:</strong> নিচের তালিকায় সিস্টেমের টেস্ট করার জন্য কিছু নমুনা মুয়াল্লিম ও স্টাফের নাম রয়েছে। আপনি <strong>&quot;ডেমো ইউজার ডাটা মুছুন&quot;</strong> বোতামে ক্লিক করে এগুলো সহজেই পরিষ্কার করে নিজের মাদ্রাসার আসল শিক্ষকদের যোগ করতে পারেন।
            </span>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম, মোবাইল বা ইমেইল দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              roleFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            সকল ({safeUsers.length})
          </button>
          <button
            onClick={() => setRoleFilter('teacher')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              roleFilter === 'teacher' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            মুয়াল্লিম ({safeUsers.filter(u => u.role === 'teacher').length})
          </button>
          <button
            onClick={() => setRoleFilter('accountant')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              roleFilter === 'accountant' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            হিসাবরক্ষক ({safeUsers.filter(u => u.role === 'accountant').length})
          </button>
          <button
            onClick={() => setRoleFilter('staff')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              roleFilter === 'staff' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            অফিস স্টাফ ({safeUsers.filter(u => u.role === 'staff').length})
          </button>
          <button
            onClick={() => setRoleFilter('guardian')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              roleFilter === 'guardian' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            অভিভাবক ({safeUsers.filter(u => u.role === 'guardian').length})
          </button>
        </div>
      </div>

      {/* Users List Container (Desktop Table + Mobile Cards) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-4">নাম ও পদবী</th>
                <th className="p-4">মোবাইল ও ইমেইল</th>
                <th className="p-4">রোল / ভূমিকা</th>
                <th className="p-4">পাসওয়ার্ড</th>
                <th className="p-4">অনুমোদিত শ্রেণি</th>
                <th className="p-4 text-right">একশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    কোনো ব্যবহারকারী খুঁজে পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                  filteredUsers.map(u => {
                    const isCurrentAuthUser = Boolean(authUser?.email && u.email?.toLowerCase() === authUser.email.toLowerCase());
                    return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{u.nameBn || u.name}</span>
                          {isCurrentAuthUser && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                              আপনি (ওনার)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">{u.designation || 'মাদ্রাসা স্টাফ'}</div>
                      </td>
                    <td className="p-4 text-slate-600">
                      <div className="font-mono text-slate-800 font-semibold">{u.phone || 'N/A'}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{u.email || ''}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        u.role === 'super_admin' ? 'bg-slate-900 text-white' :
                        u.role === 'teacher' ? 'bg-emerald-100 text-emerald-800' :
                        u.role === 'accountant' ? 'bg-blue-100 text-blue-800' :
                        u.role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {u.role === 'super_admin' ? 'সুপার অ্যাডমিন' :
                         u.role === 'teacher' ? 'মুয়াল্লিম (শিক্ষক)' :
                         u.role === 'accountant' ? 'হিসাবরক্ষক' :
                         u.role === 'guardian' ? 'অভিভাবক' : 'অফিস স্টাফ'}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">{u.password || '******'}</span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {u.assignedClasses && Array.isArray(u.assignedClasses) && u.assignedClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.assignedClasses.map(c => (
                            <span key={c} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700">{c}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">{u.role === 'super_admin' ? 'সকল শ্রেণি' : 'নির্দিষ্ট নয়'}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                          title="এডিট"
                        >
                          <Edit2 size={14} />
                        </button>
                        {u.role !== 'super_admin' && (
                          <button
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="ডিলিট"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-medium text-xs">
              কোনো ব্যবহারকারী খুঁজে পাওয়া যায়নি।
            </div>
          ) : (
            filteredUsers.map(u => (
              <div key={u.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      u.role === 'super_admin' ? 'bg-slate-900 text-white' :
                      u.role === 'teacher' ? 'bg-emerald-100 text-emerald-800' :
                      u.role === 'accountant' ? 'bg-blue-100 text-blue-800' :
                      u.role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {(u.nameBn || u.name || 'ইউ').substring(0, 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-xs leading-tight">
                          {u.nameBn || u.name}
                        </h4>
                        {Boolean(authUser?.email && u.email?.toLowerCase() === authUser.email.toLowerCase()) && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                            আপনি (ওনার)
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {u.designation || 'মাদ্রাসা স্টাফ'}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${
                    u.role === 'super_admin' ? 'bg-slate-900 text-white' :
                    u.role === 'teacher' ? 'bg-emerald-100 text-emerald-800' :
                    u.role === 'accountant' ? 'bg-blue-100 text-blue-800' :
                    u.role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {u.role === 'super_admin' ? 'সুপার এডমিন' :
                     u.role === 'teacher' ? 'মুয়াল্লিম' :
                     u.role === 'accountant' ? 'হিসাবরক্ষক' :
                     u.role === 'guardian' ? 'অভিভাবক' : 'স্টাফ'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[9px] font-semibold">মোবাইল</span>
                    <a href={`tel:${u.phone}`} className="font-mono font-semibold text-slate-800 hover:text-emerald-600">
                      {u.phone || 'N/A'}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] font-semibold">পাসওয়ার্ড</span>
                    <span className="font-mono font-bold text-slate-700">
                      {u.password || '******'}
                    </span>
                  </div>
                </div>

                {u.assignedClasses && Array.isArray(u.assignedClasses) && u.assignedClasses.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">শ্রেণি:</span>
                    {u.assignedClasses.map(c => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700 font-medium">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 size={12} />
                    <span>এডিট</span>
                  </button>
                  {u.role !== 'super_admin' && (
                    <button
                      onClick={() => setUserToDelete(u)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>ডিলিট</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              {editingUser ? 'ইউজার তথ্য আপডেট' : 'নতুন ইউজার তৈরি করুন'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">নাম (বাংলা)</label>
                  <input
                    type="text"
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    placeholder="যেমন: মাওলানা হাফিজুর রহমান"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">নাম (ইংরেজি)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name in English"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মোবাইল নম্বর (লগইন আইডি)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">লগইন পাসওয়ার্ড</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="123"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">রোল / পারমিশন</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="teacher">মুয়াল্লিম / শিক্ষক (Teacher)</option>
                    <option value="accountant">হিসাবরক্ষক (Accountant)</option>
                    <option value="staff">অফিস স্টাফ (Staff)</option>
                    <option value="guardian">অভিভাবক (Guardian)</option>
                    <option value="super_admin">সুপার অ্যাডমিন (Super Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পদবী / বিবরণ</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="যেমন: আরবি মুয়াল্লিম"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Assigned Classes selector */}
              {role === 'teacher' && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-slate-700">অনুমোদিত শ্রেণি নির্বাচন করুন:</label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {(classes || []).map(c => {
                      const isSelected = (assignedClasses || []).includes(c.name);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleClassAssignment(c.name)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {c.nameBn || c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingUser ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={executeDelete}
        title="ইউজার অ্যাকাউন্ট ডিলিট নিশ্চিতকরণ"
        message={`আপনি কি নিশ্চিত যে ${userToDelete?.nameBn || userToDelete?.name} এর অ্যাকাউন্টটি মুছে ফেলতে চান?`}
        confirmLabel="হ্যাঁ, ডিলিট করুন"
        cancelLabel="বাতিল"
        variant="danger"
      />
    </div>
  );
};
