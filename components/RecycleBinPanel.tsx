import React, { useState } from 'react';
import { Trash2, RotateCcw, X, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { SegmentedControl } from './ui/SegmentedControl';

// Shared Recycle Bin UI — the same panel powers both entries:
//  - the dedicated Recycle Bin page (menu tab 'recycle_bin'), and
//  - the "রিসাইকেল বিন দেখুন" modal inside Data Security & Backup Hub.
// Behaviour mirrors the original modal exactly: filter chips, per-item
// restore / permanent delete, restore-all, and confirmed empty-trash.
// Nothing here deletes on its own: restore puts the item back, permanent
// delete removes only that bin entry, empty-trash asks first.
export const RecycleBinPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { trashBin, restoreFromTrash, permanentlyDeleteTrashItem, restoreAllFromTrash, emptyTrash } = useApp();
  const [trashFilter, setTrashFilter] = useState<'all' | 'student' | 'subject' | 'exam' | 'class' | 'transaction' | 'section' | 'teacher' | 'user' | 'notice' | 'member_application'>('all');
  const [confirmEmptyTrashOpen, setConfirmEmptyTrashOpen] = useState(false);
  // Phase 2: EVERY trash op confirms first, with a count/name preview.
  // Previously restore, restore-all and per-item permanent delete all
  // ran on a single click — per-item permanent delete had NO dialog
  // at all. Restore-all keeps rejected applications in the bin (they
  // are records, not restores — see AppContext restoreFromTrash).
  const [confirmPermanentItem, setConfirmPermanentItem] = useState<{ id: string; name: string } | null>(null);
  const [confirmRestoreItem, setConfirmRestoreItem] = useState<{ id: string; name: string } | null>(null);
  const [confirmRestoreAllOpen, setConfirmRestoreAllOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);
  const restorableCount = trashBin.filter(t => t.type !== 'member_application').length;

  const handleRestoreItemConfirm = () => {
    if (!confirmRestoreItem) return;
    restoreFromTrash(confirmRestoreItem.id);
    setStatusMessage({
      type: 'success',
      text: `"${confirmRestoreItem.name}" সফলভাবে রিসাইকেল বিন থেকে পুনরুদ্ধার করা হয়েছে!`
    });
    setConfirmRestoreItem(null);
  };

  const handlePermanentDeleteConfirm = () => {
    if (!confirmPermanentItem) return;
    permanentlyDeleteTrashItem(confirmPermanentItem.id);
    setStatusMessage({
      type: 'info',
      text: `"${confirmPermanentItem.name}" রিসাইকেল বিন থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে।`
    });
    setConfirmPermanentItem(null);
  };

  const handleRestoreAllConfirm = () => {
    restoreAllFromTrash();
    setConfirmRestoreAllOpen(false);
    setStatusMessage({
      type: 'success',
      text: 'রিসাইকেল বিনের সকল তথ্য সফলভাবে মূল সিস্টেমে ফিরিয়ে আনা হয়েছে!'
    });
    if (onClose) onClose();
  };

  const handleEmptyTrashConfirm = () => {
    emptyTrash();
    setConfirmEmptyTrashOpen(false);
    setStatusMessage({
      type: 'info',
      text: `রিসাইকেল বিনের ${trashBin.length}টি আইটেম স্থায়ীভাবে মুছে ফেলা হয়েছে।`
    });
  };

  const filteredItems = trashBin.filter(t => trashFilter === 'all' || t.type === trashFilter);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
            <RotateCcw size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {onClose ? 'স্মার্ট রিসাইকেল বিন ও ডেটা রিকভারি' : 'রিসাইকেল বিন'}
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                {trashBin.length}
              </span>
            </h3>
            {!onClose && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ভুল করে মুছে ফেলা শিক্ষার্থী, শিক্ষক/কর্মী, বিষয়, পরীক্ষা, নোটিশ বা লেনদেন এখানে থাকে — ফিরিয়ে আনতে বা স্থায়ীভাবে মুছতে পারবেন। বাতিল করা আবেদন শুধু রেকর্ড হিসেবে থাকে।
              </p>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {statusMessage && (
        <div className={`mt-4 px-3.5 py-2.5 rounded-xl text-xs font-semibold border ${statusMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'}`}>
          {statusMessage.text}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="py-3 border-b border-slate-100 dark:border-slate-800">
        <SegmentedControl
          value={trashFilter}
          onChange={(id) => setTrashFilter(id as any)}
          ariaLabel="রিসাইকেল বিন ফিল্টার"
          options={[
            { id: 'all', label: 'সকল', badge: trashBin.length },
            { id: 'student', label: 'শিক্ষার্থী', badge: trashBin.filter(t => t.type === 'student').length },
            { id: 'subject', label: 'বিষয়', badge: trashBin.filter(t => t.type === 'subject').length },
            { id: 'exam', label: 'পরীক্ষা', badge: trashBin.filter(t => t.type === 'exam').length },
            { id: 'class', label: 'শ্রেণি', badge: trashBin.filter(t => t.type === 'class').length },
            { id: 'section', label: 'শাখা', badge: trashBin.filter(t => t.type === 'section').length },
            { id: 'teacher', label: 'শিক্ষক/কর্মী', badge: trashBin.filter(t => t.type === 'teacher').length },
            { id: 'user', label: 'অ্যাকাউন্ট', badge: trashBin.filter(t => t.type === 'user').length },
            { id: 'notice', label: 'নোটিশ', badge: trashBin.filter(t => t.type === 'notice').length },
            { id: 'transaction', label: 'লেনদেন', badge: trashBin.filter(t => t.type === 'transaction').length },
            { id: 'member_application', label: 'বাতিল আবেদন', badge: trashBin.filter(t => t.type === 'member_application').length },
          ]}
        />
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-[220px]">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">রিসাইকেল বিন সম্পূর্ণ ফাঁকা</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const itemName = item.data?.name || item.data?.nameBn || item.data?.title || item.data?.description || `আইটেম #${item.id.slice(0, 6)}`;
            // Phase 2: every type gets its own label — previously
            // 'section' (and any new type) fell through to 'লেনদেন'.
            const typeLabel =
              item.type === 'student' ? 'শিক্ষার্থী' :
              item.type === 'subject' ? 'বিষয়' :
              item.type === 'exam' ? 'পরীক্ষা' :
              item.type === 'class' ? 'শ্রেণি' :
              item.type === 'section' ? 'শাখা' :
              item.type === 'teacher' ? 'শিক্ষক/কর্মী' :
              item.type === 'user' ? 'অ্যাকাউন্ট' :
              item.type === 'notice' ? 'নোটিশ' :
              item.type === 'member_application' ? 'বাতিল আবেদন' : 'লেনদেন';

            const typeBg =
              item.type === 'student' ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
              item.type === 'subject' ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' :
              item.type === 'exam' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
              item.type === 'class' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
              item.type === 'section' ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800' :
              item.type === 'teacher' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' :
              item.type === 'user' ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800' :
              item.type === 'notice' ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' :
              item.type === 'member_application' ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';

            return (
              <div
                key={item.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${typeBg}`}>
                    {typeLabel}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {itemName}
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 mt-0.5">
                      {item.data?.studentId && <span>আইডি: {item.data.studentId}</span>}
                      {item.data?.classLevel && <span>শ্রেণি: {item.data.classLevel}</span>}
                      {item.deletedAt && <span>মুছে ফেলা হয়েছে: {item.deletedAt}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.type === 'member_application' ? (
                    <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700" title="বাতিল আবেদন শুধু রেকর্ড হিসেবে থাকে — ফিরিয়ে আনতে হলে নতুন করে যুক্ত করুন">
                      শুধু রেকর্ড
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmRestoreItem({ id: item.id, name: itemName })}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-all active:scale-95"
                      title="পুনরুদ্ধার করুন"
                    >
                      <RotateCcw size={12} />
                      <span>ফিরিয়ে আনুন</span>
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmPermanentItem({ id: item.id, name: itemName })}
                    className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                    title="স্থায়ীভাবে মুছুন"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {trashBin.length > 0 && (
            <>
              <button
                onClick={() => setConfirmRestoreAllOpen(true)}
 className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <RotateCcw size={13} />
                <span>সকল ডেটা ফিরিয়ে আনুন</span>
              </button>
              <button
                onClick={() => setConfirmEmptyTrashOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all border border-slate-200 dark:border-slate-800"
              >
                <Trash2 size={13} />
                <span>রিসাইকেল বিন খালি করুন</span>
              </button>
            </>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition-all"
          >
            বন্ধ করুন
          </button>
        )}
      </div>

      {/* Phase 2: every trash op confirms with a preview first. */}
      <ConfirmDialog
        isOpen={!!confirmRestoreItem}
        onClose={() => setConfirmRestoreItem(null)}
        onConfirm={handleRestoreItemConfirm}
        title="এই আইটেমটি ফিরিয়ে আনতে চান?"
        message="আইটেমটি রিসাইকেল বিন থেকে মূল সিস্টেমে ফিরে যাবে।"
        highlightText={confirmRestoreItem ? confirmRestoreItem.name : undefined}
        confirmLabel="হ্যাঁ, ফিরিয়ে আনুন"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!confirmPermanentItem}
        onClose={() => setConfirmPermanentItem(null)}
        onConfirm={handlePermanentDeleteConfirm}
        title="এই আইটেমটি স্থায়ীভাবে মুছে ফেলতে চান?"
        message="একবার স্থায়ীভাবে মুছলে এটি আর ফিরিয়ে আনা যাবে না।"
        highlightText={confirmPermanentItem ? confirmPermanentItem.name : undefined}
        confirmLabel="হ্যাঁ, স্থায়ীভাবে মুছুন"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={confirmRestoreAllOpen}
        onClose={() => setConfirmRestoreAllOpen(false)}
        onConfirm={handleRestoreAllConfirm}
        title="সকল ডেটা ফিরিয়ে আনতে চান?"
        message={trashBin.some(t => t.type === 'member_application')
          ? `রিসাইকেল বিনের ${restorableCount}টি আইটেম মূল সিস্টেমে ফিরে যাবে। বাতিল করা আবেদনগুলো রেকর্ড হিসেবে বিনেই থাকবে।`
          : `রিসাইকেল বিনের ${restorableCount}টি আইটেম মূল সিস্টেমে ফিরে যাবে।`}
        confirmLabel="হ্যাঁ, সব ফিরিয়ে আনুন"
        variant="danger"
      />
      {/* Confirmation Dialog for Empty Trash */}
      <ConfirmDialog
        isOpen={confirmEmptyTrashOpen}
        onClose={() => setConfirmEmptyTrashOpen(false)}
        onConfirm={handleEmptyTrashConfirm}
        title="রিসাইকেল বিন স্থায়ীভাবে খালি করতে চান?"
        message={`আপনি কি নিশ্চিত যে রিসাইকেল বিনের সমস্ত ${trashBin.length}টি আইটেম স্থায়ীভাবে মুছে ফেলতে চান? একবার খালি করলে এগুলি আর পুনরুদ্ধার করা সম্ভব হবে না।`}
        confirmLabel="হ্যাঁ, স্থায়ীভাবে খালি করুন"
        variant="danger"
      />
    </div>
  );
};
