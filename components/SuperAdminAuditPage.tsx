import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fetchPlatformAuditLogs, logAuditEvent } from '../services/auditLog';
import type { PlatformAuditLogEntry, AuditActionType } from '../types/rbac';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Search, 
  RefreshCw, 
  Filter, 
  UserCheck, 
  Clock, 
  Key, 
  Building2, 
  ArrowRight,
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatSafeDateTime } from '../services/utils';

export const SuperAdminAuditPage: React.FC = () => {
  const { authUser, authClaims, isSuperAdmin, language } = useApp();
  const [logs, setLogs] = useState<PlatformAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<PlatformAuditLogEntry | null>(null);

  // Security Verification Guard
  const verifiedEmail = (authUser?.email || '').toLowerCase();
  const isAuthorized = isSuperAdmin || verifiedEmail === 'mehedihasansagor26@gmail.com';

  const loadLogs = async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    try {
      const fetched = await fetchPlatformAuditLogs({ maxEntries: 100 });
      setLogs(fetched);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadLogs();
      // Record access event into the audit trail
      if (authUser) {
        logAuditEvent({
          action: 'SUPERADMIN_AUDIT_ACCESSED',
          actorUid: authUser.uid,
          actorEmail: authUser.email || 'mehedihasansagor26@gmail.com',
          actorRole: 'superadmin',
          institutionId: 'platform_root',
          institutionName: 'Platform Global',
          targetType: 'system',
          targetId: 'audit_log_viewer',
          metadata: { userAgent: navigator.userAgent }
        }).catch(() => {});
      }
    }
  }, [isAuthorized]);

  // If NOT authorized Super Admin, show zero-trust denial view
  if (!isAuthorized) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
            <Lock size={32} />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-block">
              {language === 'bn' ? 'অ্যাক্সেস সংরক্ষিত' : 'Restricted Access'}
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              {language === 'bn' ? 'সুপার এডমিন সিকিউরিটি অডিট' : 'Super Admin Security Audit'}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {language === 'bn'
                ? 'এই প্ল্যাটফর্ম অডিট পেজটি কেবলমাত্র অনুমোদিত প্ল্যাটফর্ম ওনার (mehedihasansagor26@gmail.com) এর জন্য সংরক্ষিত। কোনো সাধারণ এডমিন বা শিক্ষক এটি দেখার অধিকার রাখেন না।'
                : 'This platform security audit area is strictly restricted to the verified platform owner. Ordinary institution admins or staff have zero access.'}
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-left font-mono text-[11px] text-slate-600">
            <div>Expected: <span className="font-bold text-slate-800">mehedihasansagor26@gmail.com</span></div>
            <div>Current: <span className="font-bold text-rose-700">{verifiedEmail || 'Unauthenticated'}</span></div>
          </div>
        </div>
      </div>
    );
  }

  // Filter logs based on search and action filter
  const filteredLogs = logs.filter(item => {
    const matchesAction = selectedActionFilter === 'ALL' || item.action === selectedActionFilter;
    const matchesSearch = 
      searchTerm === '' ||
      item.actorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.targetEmail && item.targetEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.institutionName && item.institutionName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.action.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>{language === 'bn' ? 'প্ল্যাটফর্ম ওনার সিকিউরিটি জোন' : 'Platform Owner Security Zone'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>{language === 'bn' ? 'সুপার এডমিন কন্ট্রোল ও অডিট লগ' : 'Super Admin Security Audit'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {language === 'bn'
                ? 'সকল মাদ্রাসা ও প্রতিষ্ঠানের কাস্টম রোল তৈরি, পারমিশন পরিবর্তন ও মেম্বারশিপ অ্যাসাইনমেন্টের অপরিবর্তনশীল (Immutable) অডিট হিস্টোরি।'
                : 'Tamper-evident, immutable audit trail of all role mutations, permission updates, and membership assignments across all tenant institutions.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 px-4 py-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 block font-mono">VERIFIED SUPER ADMIN</span>
              <span className="text-xs font-bold text-emerald-400 font-mono truncate max-w-[200px] block">
                {verifiedEmail}
              </span>
            </div>
            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Logs"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'ইমেইল, প্রতিষ্ঠান বা অ্যাকশন খুঁজুন...' : 'Search by email, institution, or action...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
          />
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 font-medium shrink-0">Filter:</span>
          <select
            value={selectedActionFilter}
            onChange={(e) => setSelectedActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Actions ({logs.length})</option>
            <option value="ROLE_CREATED">Role Created</option>
            <option value="ROLE_PERMISSIONS_CHANGED">Permissions Changed</option>
            <option value="MEMBER_ASSIGNED_ROLE">Member Assigned Role</option>
            <option value="MEMBER_STATUS_CHANGED">Member Status Changed</option>
            <option value="SUPERADMIN_AUDIT_ACCESSED">Audit Accessed</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table & Details Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800">
                {language === 'bn' ? 'অডিট ইভেন্ট তালিকা' : 'Audit Events'} ({filteredLogs.length})
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">collection: /platformAuditLogs</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <RefreshCw size={24} className="animate-spin mx-auto text-indigo-500" />
                <p className="text-xs font-medium">Loading platform audit logs from Firestore...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <ShieldAlert size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No audit records found matching query.</p>
                <p className="text-[11px] text-slate-400">Audit logs are recorded automatically when custom roles or memberships change.</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          log.action.includes('CREATED') ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          log.action.includes('CHANGED') || log.action.includes('PERMISSIONS') ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          log.action.includes('SUPERADMIN') ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock size={11} />
                          {formatSafeDateTime(log.timestamp)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-800 font-semibold truncate flex items-center gap-1.5">
                        <UserCheck size={13} className="text-indigo-600 shrink-0" />
                        <span className="text-indigo-950 font-bold">{log.actorEmail}</span>
                        <ArrowRight size={11} className="text-slate-400 shrink-0" />
                        <span className="text-slate-600 truncate">{log.targetType}: {log.targetName || log.targetId}</span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Building2 size={12} className="text-slate-400" />
                          {log.institutionName || log.institutionId}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-end">
                      <button className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors">
                        View Diff
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Log Detail Inspector */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Key size={15} className="text-indigo-600" />
              <span>Event Details</span>
            </h3>
            {selectedLog && (
              <span className="font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                {selectedLog.id}
              </span>
            )}
          </div>

          {selectedLog ? (
            <div className="space-y-4 text-xs">
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                <div className="flex justify-between">
                  <span className="text-slate-400">Action:</span>
                  <span className="font-bold text-slate-800">{selectedLog.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Actor Email:</span>
                  <span className="font-mono font-semibold text-indigo-700">{selectedLog.actorEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Actor UID:</span>
                  <span className="font-mono text-[10px] text-slate-600 truncate max-w-[180px]">{selectedLog.actorUid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Institution:</span>
                  <span className="font-semibold text-slate-800">{selectedLog.institutionName} ({selectedLog.institutionId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="font-mono text-slate-700">{formatSafeDateTime(selectedLog.timestamp)}</span>
                </div>
              </div>

              {/* Before / After Diff */}
              <div className="space-y-3">
                <span className="font-bold text-slate-700 block">State Mutation Comparison:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-rose-800 uppercase block">Before</span>
                    <pre className="text-[10px] font-mono text-rose-950 overflow-x-auto max-h-40 whitespace-pre-wrap">
                      {selectedLog.before ? JSON.stringify(selectedLog.before, null, 2) : '(Initial creation)'}
                    </pre>
                  </div>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">After</span>
                    <pre className="text-[10px] font-mono text-emerald-950 overflow-x-auto max-h-40 whitespace-pre-wrap">
                      {selectedLog.after ? JSON.stringify(selectedLog.after, null, 2) : '(Deleted)'}
                    </pre>
                  </div>
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                  <span className="text-slate-400 font-bold block">Metadata:</span>
                  <pre className="text-[10px] font-mono text-slate-700 overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 size={28} className="mx-auto text-slate-300" />
              <p className="text-xs">Click on any audit event from the left table to inspect the complete cryptographic actor details and before/after state diff.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
