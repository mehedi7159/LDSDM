import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Settings, Save, Plus, GraduationCap, BookOpen, LogIn, CalendarRange,
  FileText, ClipboardList, FileSpreadsheet, UtensilsCrossed, Tag,
  Wallet, User, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { ClassFeeStructure, SchoolClass } from '../../types';
import {
  FeeTypeDef, FeeFrequency, FeeAppliesTo, FeeCollector,
  DEFAULT_FEE_TYPES, FEE_FREQUENCY_LABELS, FEE_APPLIES_TO_LABELS, FEE_COLLECTOR_LABELS,
  enabledFeeTypes, structureAmounts, toLegacyFields,
} from '../../services/feeTypes';
import { Button } from '../ui/Button';
import type { CloudConfirmResult } from '../../services/cloudConfirm';

interface ClassFeeSettingsProps {
  classes: SchoolClass[];
  feeStructures: ClassFeeStructure[];
  feeTypes: FeeTypeDef[];
  language: 'en' | 'bn';
  onUpdateFeeStructure: (structure: ClassFeeStructure) => void;
  onUpdateFeeTypes: (types: FeeTypeDef[]) => void;
  onConfirmFeeStructures: (nextStructures?: ClassFeeStructure[]) => Promise<CloudConfirmResult>;
  onConfirmFeeTypes: (nextTypes?: FeeTypeDef[]) => Promise<CloudConfirmResult>;
  showToast: (msg: string) => void;
}

type Drafts = Record<string, Record<string, string>>;

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tuition: GraduationCap,
  admission: LogIn,
  session: CalendarRange,
  exam: FileText,
  registration: ClipboardList,
  form_fillup: FileSpreadsheet,
  book: BookOpen,
  food: UtensilsCrossed,
};

/** Parse a typed amount: empty / invalid / negative -> 0, floored. */
function parseAmount(raw: string): number {
  const n = Math.floor(Number(String(raw).replace(/[^0-9.-]/g, '')));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function draftsFromProps(classes: SchoolClass[], feeStructures: ClassFeeStructure[]): Drafts {
  const out: Drafts = {};
  classes.forEach(c => {
    const existing = feeStructures.find(f => f.classLevel === c.name);
    const amounts = existing ? structureAmounts(existing) : {};
    const row: Record<string, string> = {};
    DEFAULT_FEE_TYPES.forEach(t => {
      row[t.id] = String(Number(amounts[t.id]) || 0);
    });
    // Custom types already stored on this class (amounts beyond the seed).
    Object.keys(amounts).forEach(id => {
      if (!(id in row)) row[id] = String(Number(amounts[id]) || 0);
    });
    out[c.name] = row;
  });
  return out;
}

interface FeeClassCardProps {
  /** Stable key: the class name (c.name), NOT the localized label. */
  className: string;
  classLabel: string;
  draft: Record<string, string>;
  types: FeeTypeDef[];
  dirty: boolean;
  saving: boolean;
  isBn: boolean;
  onDraftChange: (className: string, typeId: string, value: string) => void;
  onSave: (className: string) => void;
}

const FeeClassCard = React.memo(function FeeClassCard({
  className, classLabel, draft, types, dirty, saving, isBn, onDraftChange, onSave,
}: FeeClassCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-sm text-slate-900 dark:text-white">{classLabel}</span>
        </div>
        {dirty && (
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
            {isBn ? 'অসংরক্ষিত' : 'Unsaved'}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {types.map(t => (
          <label key={t.id} className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isBn ? t.labelBn : t.labelEn}
            </span>
            <span className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-400">৳</span>
              <input
                type="text"
                inputMode="numeric"
                value={draft[t.id] ?? '0'}
                onChange={(e) => onDraftChange(className, t.id, e.target.value)}
                disabled={saving}
                className="w-24 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-bold text-xs text-right focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
            </span>
          </label>
        ))}
      </div>
      <Button
        onClick={() => onSave(className)}
        size="sm"
        variant="secondary"
        disabled={saving}
        className="w-full text-xs"
      >
        <Save className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
        <span>{saving ? (isBn ? 'সংরক্ষণ হচ্ছে…' : 'Saving…') : (isBn ? 'সেভ' : 'Save')}</span>
      </Button>
    </div>
  );
});

export const ClassFeeSettings: React.FC<ClassFeeSettingsProps> = ({
  classes,
  feeStructures,
  feeTypes,
  language,
  onUpdateFeeStructure,
  onUpdateFeeTypes,
  onConfirmFeeStructures,
  onConfirmFeeTypes,
  showToast,
}) => {
  const isBn = language === 'bn';
  const types = feeTypes && feeTypes.length > 0 ? feeTypes : DEFAULT_FEE_TYPES;
  const enabled = useMemo(() => enabledFeeTypes(types), [types]);
  const disabledTypes = useMemo(() => types.filter(t => !t.enabled), [types]);

  // --- Local drafts (Part A flicker fix) ---
  // Inputs are STRINGS: typing never snaps to 0 (the old Number() onChange
  // turned a cleared field into 0 mid-keystroke — the visible flicker).
  // Snapshots refresh only NON-dirty classes, so a snapshot can never
  // clobber an in-progress edit; Save clears the dirty flag.
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFromProps(classes, feeStructures));
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [savingType, setSavingType] = useState<string | null>(null);
  const draftsRef = useRef(drafts);
  useEffect(() => { draftsRef.current = drafts; }, [drafts]);
  const dirtyRef = useRef(dirty);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  useEffect(() => {
    const fresh = draftsFromProps(classes, feeStructures);
    setDrafts(prev => {
      const next = { ...prev };
      let changed = false;
      classes.forEach(c => {
        if (!dirtyRef.current[c.name] && JSON.stringify(next[c.name]) !== JSON.stringify(fresh[c.name])) {
          next[c.name] = fresh[c.name];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeStructures, feeTypes]);

  const handleDraftChange = useCallback((className: string, typeId: string, value: string) => {
    setDrafts(prev => ({
      ...prev,
      [className]: { ...(prev[className] || {}), [typeId]: value },
    }));
    setDirty(prev => ({ ...prev, [className]: true }));
  }, []);

  const buildStructure = useCallback((className: string): ClassFeeStructure | null => {
    const cls = classes.find(c => c.name === className);
    if (!cls) return null;
    const draft = draftsRef.current[className] || {};
    const existing = feeStructures.find(f => f.classLevel === className);
    const prevAmounts = existing ? structureAmounts(existing) : {};
    const amounts: Record<string, number> = { ...prevAmounts };
    enabled.forEach(t => {
      amounts[t.id] = parseAmount(draft[t.id] ?? '0');
    });
    // Disabled types keep their stored amounts (never wiped by a save).
    return {
      id: existing?.id || `fs-${cls.id}`,
      classLevel: className,
      ...toLegacyFields(amounts),
      amounts,
    };
  }, [classes, enabled, feeStructures]);

  const handleSave = useCallback(async (className: string) => {
    const structure = buildStructure(className);
    if (!structure) return;
    setSaving(prev => ({ ...prev, [className]: true }));
    const nextStructures = feeStructures.some(f => f.classLevel === className)
      ? feeStructures.map(f => (f.classLevel === className ? structure : f))
      : [...feeStructures, structure];
    onUpdateFeeStructure(structure);
    const result = await onConfirmFeeStructures(nextStructures);
    setSaving(prev => ({ ...prev, [className]: false }));
    if (result.success) {
      setDirty(prev => ({ ...prev, [className]: false }));
      showToast(isBn ? `"${className}" শ্রেণির ফি কাঠামো সংরক্ষিত হয়েছে!` : `Fee structure for ${className} saved!`);
    } else {
      showToast(result.message || (isBn ? 'সংরক্ষণ ব্যর্থ — আবার চেষ্টা করুন।' : 'Save failed — please retry.'));
    }
  }, [buildStructure, feeStructures, isBn, onConfirmFeeStructures, onUpdateFeeStructure, showToast]);

  const handleSaveAll = useCallback(async () => {
    setSavingAll(true);
    const nextStructures = feeStructures.slice();
    classes.forEach(c => {
      const structure = buildStructure(c.name);
      if (!structure) return;
      const idx = nextStructures.findIndex(f => f.classLevel === c.name);
      if (idx >= 0) nextStructures[idx] = structure;
      else nextStructures.push(structure);
      onUpdateFeeStructure(structure);
    });
    const result = await onConfirmFeeStructures(nextStructures);
    setSavingAll(false);
    if (result.success) {
      setDirty({});
      showToast(isBn ? 'সব শ্রেণির ফি কাঠামো সংরক্ষিত হয়েছে!' : 'All class fee structures saved!');
    } else {
      showToast(result.message || (isBn ? 'সংরক্ষণ ব্যর্থ — আবার চেষ্টা করুন।' : 'Save failed — please retry.'));
    }
  }, [buildStructure, classes, feeStructures, isBn, onConfirmFeeStructures, onUpdateFeeStructure, showToast]);

  const handleToggleType = useCallback(async (typeId: string, nextEnabled: boolean) => {
    setSavingType(typeId);
    const nextTypes = types.map(t => (t.id === typeId ? { ...t, enabled: nextEnabled } : t));
    onUpdateFeeTypes(nextTypes);
    const result = await onConfirmFeeTypes(nextTypes);
    setSavingType(null);
    if (result.success) {
      showToast(isBn ? 'ফি-র ধরন সংরক্ষিত হয়েছে!' : 'Fee type saved!');
    } else {
      showToast(result.message || (isBn ? 'সংরক্ষণ ব্যর্থ — আবার চেষ্টা করুন।' : 'Save failed — please retry.'));
    }
  }, [types, isBn, onConfirmFeeTypes, onUpdateFeeTypes, showToast]);

  // --- Add a new fee type (data, no code change) ---
  const [newNameBn, setNewNameBn] = useState('');
  const [newFreq, setNewFreq] = useState<FeeFrequency>('per_event');
  const [newApplies, setNewApplies] = useState<FeeAppliesTo>('all');
  const [newCollector, setNewCollector] = useState<FeeCollector>('accountant');
  const [addingType, setAddingType] = useState(false);

  const handleAddType = useCallback(async () => {
    const name = newNameBn.trim();
    if (!name) {
      showToast(isBn ? 'ফি-র নাম লিখুন।' : 'Enter the fee name.');
      return;
    }
    setAddingType(true);
    const id = `custom-${Date.now()}`;
    const nextTypes = [...types, {
      id, labelBn: name, labelEn: name,
      frequency: newFreq, appliesTo: newApplies, collector: newCollector, enabled: true,
    }];
    onUpdateFeeTypes(nextTypes);
    const result = await onConfirmFeeTypes(nextTypes);
    setAddingType(false);
    if (result.success) {
      setNewNameBn('');
      showToast(isBn ? `"${name}" যোগ হয়েছে!` : `"${name}" added!`);
    } else {
      showToast(result.message || (isBn ? 'সংরক্ষণ ব্যর্থ — আবার চেষ্টা করুন।' : 'Save failed — please retry.'));
    }
  }, [newNameBn, newFreq, newApplies, newCollector, types, isBn, onConfirmFeeTypes, onUpdateFeeTypes, showToast]);

  return (
    <div className="space-y-5">
      {/* ============ Fee types (data) ============ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {isBn ? 'ফি-র ধরন' : 'Fee Types'}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {types.filter(t => t.enabled).map(t => {
            const Icon = TYPE_ICONS[t.id] || Tag;
            const busy = savingType === t.id;
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 p-3">
                <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {isBn ? t.labelBn : t.labelEn}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{FEE_FREQUENCY_LABELS[t.frequency]}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{FEE_APPLIES_TO_LABELS[t.appliesTo]}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{FEE_COLLECTOR_LABELS[t.collector]}</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleToggleType(t.id, false)}
                  className="shrink-0 w-11 h-6 rounded-full bg-emerald-500 relative transition-colors disabled:opacity-50"
                  aria-label={isBn ? `${t.labelBn} বন্ধ করুন` : `Turn off ${t.labelEn}`}
                >
                  <span className="absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow" />
                </button>
              </div>
            );
          })}
        </div>

        {disabledTypes.length > 0 && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              {isBn
                ? `বর্তমানে চালু নয়: ${disabledTypes.map(t => t.labelBn).join(', ')} — এগুলোর আগের মান সংরক্ষিত আছে, চার্জ হবে না।`
                : `Currently off: ${disabledTypes.map(t => t.labelEn).join(', ')} — previous values are preserved, nothing is charged.`}
            </p>
          </div>
        )}

        <div className="space-y-3 pt-1">
          {disabledTypes.map(t => {
            const Icon = TYPE_ICONS[t.id] || Tag;
            const busy = savingType === t.id;
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-3 opacity-80">
                <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1 text-sm font-bold text-slate-500">
                  {isBn ? t.labelBn : t.labelEn}
                  <span className="text-[11px] font-semibold text-slate-400"> — {isBn ? 'বন্ধ' : 'off'}</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleToggleType(t.id, true)}
                  className="shrink-0 w-11 h-6 rounded-full bg-slate-300 dark:bg-slate-700 relative transition-colors disabled:opacity-50"
                  aria-label={isBn ? `${t.labelBn} চালু করুন` : `Turn on ${t.labelEn}`}
                >
                  <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow" />
                </button>
              </div>
            );
          })}

          <div className="rounded-2xl border border-slate-200/80 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Plus className="w-4 h-4" />
              {isBn ? 'নতুন ফি-র ধরন যোগ করুন' : 'Add a new fee type'}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newNameBn}
                onChange={e => setNewNameBn(e.target.value)}
                placeholder={isBn ? 'ফি-র নাম (যেমন: লাইব্রেরি ফি)' : 'Fee name (e.g. Library Fee)'}
                className="flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={newFreq}
                onChange={e => setNewFreq(e.target.value as FeeFrequency)}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs font-bold"
              >
                {(Object.keys(FEE_FREQUENCY_LABELS) as FeeFrequency[]).map(f => (
                  <option key={f} value={f}>{FEE_FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
              <select
                value={newApplies}
                onChange={e => setNewApplies(e.target.value as FeeAppliesTo)}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs font-bold"
              >
                {(Object.keys(FEE_APPLIES_TO_LABELS) as FeeAppliesTo[]).map(a => (
                  <option key={a} value={a}>{FEE_APPLIES_TO_LABELS[a]}</option>
                ))}
              </select>
              <select
                value={newCollector}
                onChange={e => setNewCollector(e.target.value as FeeCollector)}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs font-bold"
              >
                {(Object.keys(FEE_COLLECTOR_LABELS) as FeeCollector[]).map(c => (
                  <option key={c} value={c}>{FEE_COLLECTOR_LABELS[c]}</option>
                ))}
              </select>
              <Button onClick={handleAddType} size="sm" disabled={addingType}>
                {addingType ? (isBn ? 'যোগ হচ্ছে…' : 'Adding…') : (isBn ? 'যোগ করুন' : 'Add')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ Per-class amounts (enabled types only) ============ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isBn ? 'শ্রেণিভিত্তিক ফি' : 'Class-wise Fees'}
            </h2>
          </div>
          <Button onClick={handleSaveAll} size="sm" disabled={savingAll}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {savingAll ? (isBn ? 'সংরক্ষণ হচ্ছে…' : 'Saving…') : (isBn ? 'সব সংরক্ষণ' : 'Save All')}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {classes.map(c => (
            <FeeClassCard
              key={c.id}
              className={c.name}
              classLabel={isBn ? (c.nameBn || c.name) : c.name}
              draft={drafts[c.name] || {}}
              types={enabled}
              dirty={!!dirty[c.name]}
              saving={!!saving[c.name]}
              isBn={isBn}
              onDraftChange={handleDraftChange}
              onSave={handleSave}
            />
          ))}
        </div>

        <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          {isBn
            ? 'পরীক্ষার ফি শ্রেণি শিক্ষক সংগ্রহ করেন — হিসাবরক্ষকের আদায়ে নয়।'
            : 'Exam fee is collected by the class teacher, not the accountant.'}
        </p>
      </div>
    </div>
  );
};
