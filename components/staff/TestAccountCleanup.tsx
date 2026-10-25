/**
 * Test-account cleanup card (25 Oct 2026) — NEW file, not yet wired in.
 *
 * Admin-only (principal / super_admin). Shows the LIVE computed delete
 * list first — never a stale or assumed list — and only deletes after
 * an explicit confirm. The delete itself is one cloud-confirmed write
 * (kept teachers/users verbatim to main_store) plus matching member
 * docs; see services/testAccountCleanup.ts for the keep rule.
 *
 * Honest limits shown in the UI itself:
 * - This does NOT delete Firebase Auth users (no service account).
 * - Without every other session closed, a stale session can resurrect
 *   deleted records — no tombstone exists yet.
 * - On cloud failure nothing is reported as deleted and local state is
 *   left untouched.
 */
import React, { useState } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import { getAllInstitutionMembers } from '../../services/rbac';
import { SUPER_ADMIN_EMAIL } from '../../services/appConfig';
import {
  computeCleanupPlan,
  performCleanup,
  CLEANUP_CLOUD_FAILURE_MESSAGE,
  type CleanupPlan,
} from '../../services/testAccountCleanup';
import type { InstitutionMember } from '../../types/rbac';

type Stage = 'idle' | 'loadingMembers' | 'preview' | 'running' | 'done' | 'failed';

const INSTITUTION_ID = 'inst_madrasah_primary';

function displayName(r: { name?: string; nameBn?: string; email?: string; phone?: string }): string {
  return r.nameBn || r.name || r.email || r.phone || 'নাম নেই';
}

function displayContact(r: { email?: string; phone?: string }): string {
  return r.email || r.phone || 'যোগাযোগ নেই';
}

export const TestAccountCleanup: React.FC = () => {
  const {
    teachers = [],
    users = [],
    setTeachers,
    setUsers,
    refreshPendingMembers,
    currentUser,
    isSuperAdmin,
    authUser,
  } = useApp();

  const [stage, setStage] = useState<Stage>('idle');
  const [plan, setPlan] = useState<CleanupPlan | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [result, setResult] = useState<{
    deletedTeacherCount: number;
    deletedUserCount: number;
    deletedMemberCount: number;
    failedMembers: { uid: string; error?: string }[];
  } | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isAdmin =
    isSuperAdmin || currentUser?.role === 'super_admin' || currentUser?.role === 'principal';

  // Not an admin view at all for anyone else — the card simply does not exist.
  if (!isAdmin) return null;

  const ownerEmail = SUPER_ADMIN_EMAIL;
  const adminUid = authUser?.uid || '';

  const showPreview = async () => {
    setStage('loadingMembers');
    setMemberError(null);
    let members: InstitutionMember[] = [];
    try {
      members = await getAllInstitutionMembers(INSTITUTION_ID);
    } catch (err: unknown) {
      // Member docs are best-effort: a failed member read must not block
      // the teachers/users preview, but it must be said out loud.
      setMemberError('member তালিকা পড়া যায়নি — member doc মোছা যাচাই করে করতে হবে।');
    }
    setPlan(computeCleanupPlan(teachers, users, members, ownerEmail, adminUid));
    setStage('preview');
  };

  const runCleanup = async () => {
    if (!plan) return;
    setStage('running');
    setFailureMessage(null);
    const updatedBy =
      currentUser?.name || currentUser?.email || authUser?.email || 'admin';
    const outcome = await performCleanup(plan, {
      writeMainStore: async (keepTeachers, keepUsers) => {
        await setDoc(
          doc(db, 'institution', 'main_store'),
          {
            teachers: keepTeachers,
            users: keepUsers,
            updatedBy,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      },
      deleteMemberDoc: async (uid: string) => {
        // Firestore doc first — the local cache is purged only after a
        // confirmed delete, so a failed delete never hides a live doc.
        await deleteDoc(doc(db, 'institutions', INSTITUTION_ID, 'members', uid));
        try {
          const saved = localStorage.getItem('madrasha_institution_members');
          if (saved) {
            const list: InstitutionMember[] = JSON.parse(saved);
            localStorage.setItem(
              'madrasha_institution_members',
              JSON.stringify(list.filter(m => m.uid !== uid))
            );
          }
        } catch {}
      },
    });

    if (!outcome.success) {
      // Local state untouched on purpose — nothing was confirmed deleted.
      setFailureMessage(outcome.message || CLEANUP_CLOUD_FAILURE_MESSAGE);
      setStage('failed');
      return;
    }

    setTeachers(plan.keepTeachers);
    setUsers(plan.keepUsers);
    try {
      await refreshPendingMembers();
    } catch {}
    setResult({
      deletedTeacherCount: outcome.deletedTeacherCount,
      deletedUserCount: outcome.deletedUserCount,
      deletedMemberCount: outcome.deletedMemberCount,
      failedMembers: outcome.failedMembers,
    });
    setStage('done');
  };

  const reset = () => {
    setStage('idle');
    setPlan(null);
    setUnderstood(false);
    setResult(null);
    setFailureMessage(null);
  };

  return (
    <div className="rounded-3xl border-2 border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5 space-y-3">
      <h4 className="font-black text-slate-900 dark:text-white text-sm">
        টেস্ট অ্যাকাউন্ট cleanup (শুধু প্রিন্সিপাল)
      </h4>
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        প্রিন্সিপাল অ্যাকাউন্ট ছাড়া বাকি সব শিক্ষক/কর্মী অ্যাকাউন্ট একবারে মুছে ফেলবে।
        এটা <b>ফেরানো যাবে না</b>।
      </p>

      {!authUser && (
        <p className="text-xs font-bold text-red-700 dark:text-red-300">
          চালাতে Firebase-এ signed-in session লাগবে — লগইন ছাড়া cloud write হবে না।
        </p>
      )}

      {stage === 'idle' && (
        <button
          type="button"
          onClick={showPreview}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
        >
          মুছবে এমন তালিকা দেখুন
        </button>
      )}

      {stage === 'loadingMembers' && (
        <p className="text-xs text-slate-500">তালিকা তৈরি হচ্ছে…</p>
      )}

      {(stage === 'preview' || stage === 'running') && plan && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              মুছবে: শিক্ষক {plan.deleteTeacherCount} জন, লগইন অ্যাকাউন্ট{' '}
              {plan.deleteUserCount}টি, member doc {plan.deleteMemberCount}টি
            </p>
            {plan.deleteTeachers.map(t => (
              <p key={t.id} className="text-xs text-slate-600 dark:text-slate-300">
                • {displayName(t)} — {t.designation || 'শিক্ষক'} — {displayContact(t)}
              </p>
            ))}
            {plan.deleteUsers.map(u => (
              <p key={u.id} className="text-xs text-slate-600 dark:text-slate-300">
                • {displayName(u)} — লগইন অ্যাকাউন্ট ({u.role}) — {displayContact(u)}
              </p>
            ))}
            {plan.deleteMembers.map(m => (
              <p key={m.uid} className="text-xs text-slate-600 dark:text-slate-300">
                • {m.displayName || m.email} — member doc
              </p>
            ))}
            {plan.totalDeleteCount === 0 && (
              <p className="text-xs text-slate-500">মোছার মতো কোনো টেস্ট অ্যাকাউন্ট নেই।</p>
            )}
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 pt-1">
              থাকবে শুধু: প্রিন্সিপাল অ্যাকাউন্ট (শিক্ষক {plan.keepTeachers.length}টি, লগইন{' '}
              {plan.keepUsers.length}টি)।
            </p>
          </div>

          {memberError && <p className="text-xs font-bold text-amber-700">{memberError}</p>}

          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1">
            <p>⚠️ চালানোর আগে <b>full backup</b> নিয়ে রাখুন — মোছা ফেরানো যাবে না।</p>
            <p>
              ⚠️ চালানোর আগে <b>সব ডিভাইস/ট্যাব/AI Studio বন্ধ</b> করুন — না হলে কোনো পুরনো
              session আবার এদের cloud-এ ফিরিয়ে আনতে পারে।
            </p>
            <p>
              ⚠️ Firebase Auth user মোছা হবে না — যাদের Auth অ্যাকাউন্ট আছে, তাদের পরে
              Firebase Console → Authentication → Users থেকে মুছতে হবে, না হলে পরের
              login-এ আবার user entry ফিরতে পারে।
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
            <input
              type="checkbox"
              checked={understood}
              onChange={e => setUnderstood(e.target.checked)}
              className="mt-0.5"
            />
            <span>আমি বুঝেছি — এটা ফেরানো যাবে না, backup নিয়েছি, বাকি সব session বন্ধ করেছি।</span>
          </label>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              disabled={!understood || !authUser || stage === 'running' || plan.totalDeleteCount === 0}
              onClick={runCleanup}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
            >
              {stage === 'running' ? 'মোছা হচ্ছে…' : 'নিশ্চিত করে মুছুন'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-xs font-bold cursor-pointer"
            >
              বাতিল
            </button>
          </div>
        </div>
      )}

      {stage === 'failed' && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-red-700 dark:text-red-300">{failureMessage}</p>
          <p className="text-xs text-slate-500">স্থানীয় তথ্য অপরিবর্তিত আছে — আবার চেষ্টা করতে পারেন।</p>
          <button
            type="button"
            onClick={() => setStage('preview')}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
            মোছা সম্পন্ন — শিক্ষক {result.deletedTeacherCount} জন, লগইন অ্যাকাউন্ট{' '}
            {result.deletedUserCount}টি, member doc {result.deletedMemberCount}টি cloud-এ
            নিশ্চিত হয়েছে।
          </p>
          {result.failedMembers.length > 0 && (
            <p className="text-xs font-bold text-amber-700">
              member doc মোছা যায়নি ({result.failedMembers.length}টি):{' '}
              {result.failedMembers.map(f => f.uid).join(', ')} — আলাদা করে যাচাই করুন।
            </p>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-300">
            এবার সব ডিভাইসে app পুরো বন্ধ করে আবার খুলুন। Firebase Auth user থাকলে Console
            থেকে মুছুন।
          </p>
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-xs font-bold cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      )}
    </div>
  );
};
