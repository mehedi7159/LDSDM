import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { UserPlus, Edit2, X, Save, Loader2, Check } from 'lucide-react';
import { AcademicTeacher, SchoolClass, AppUser, UserRole } from '../../types';
import { DESIGNATION_OPTIONS, DESIGNATION_OTHER, isMappedDesignation } from '../../services/staffRole';

export interface StaffFormSavePayload {
  teacherData: {
    name: string;
    nameBn: string;
    employeeCode: string;
    designation: string;
    phone: string;
    email: string;
    password?: string;
    status: AcademicTeacher['status'];
    assignedClasses: string[];
    assignedSubjects: string[];
  };
  loginRole: UserRole;
  additionalRoles: UserRole[];
  isEditing: boolean;
}

export interface StaffFormSaveResult {
  success: boolean;
  message?: string;
  fieldErrors?: {
    employeeCode?: string;
    email?: string;
    phone?: string;
    password?: string;
    designation?: string;
  };
}

interface StaffEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTeacher: AcademicTeacher | null;
  classes: SchoolClass[];
  unifiedStaffList: AcademicTeacher[];
  users: AppUser[];
  canCreateStaff: boolean;
  isBn: boolean;
  defaultEmployeeCode?: string;
  initialLoginRole?: UserRole;
  initialAdditionalRoles?: UserRole[];
  onSave: (payload: StaffFormSavePayload) => Promise<StaffFormSaveResult>;
}

const ROLE_OPTIONS: { key: UserRole; bn: string; en: string }[] = [
  { key: 'teacher', bn: 'শিক্ষক (Teacher)', en: 'Teacher' },
  { key: 'accountant', bn: 'হিসাবরক্ষক / ক্যাশিয়ার (Accountant)', en: 'Accountant / Cashier' },
  { key: 'staff', bn: 'অফিস স্টাফ (Office Staff)', en: 'Office Staff' },
  { key: 'principal', bn: 'অধ্যক্ষ (Principal)', en: 'Principal' },
  { key: 'guardian', bn: 'অভিভাবক (Guardian)', en: 'Guardian' }
];

// ============================================================================
// Memoized Input Field Components (React.memo + forwardRef)
// Prevents sibling input re-renders on keystroke in other fields
// ============================================================================

interface MemoizedTextInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
  helperText?: string;
  mono?: boolean;
  disabled?: boolean;
}

export const MemoizedTextInput = memo(
  React.forwardRef<HTMLInputElement, MemoizedTextInputProps>(({
    label,
    value,
    onChange,
    error,
    placeholder,
    type = 'text',
    required = false,
    className = '',
    helperText,
    mono = false,
    disabled = false
  }, ref) => {
    return (
      <div className={className}>
        <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <input
          ref={ref}
          type={type}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none dark:bg-slate-800 dark:text-white ${mono ? 'font-mono' : ''} ${error ? 'border-rose-400 focus:ring-rose-500' : ''}`}
        />
        {error && <p className="text-[11px] text-rose-600 font-bold mt-1">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{helperText}</p>}
      </div>
    );
  })
);
MemoizedTextInput.displayName = 'MemoizedTextInput';

interface MemoizedSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  helperText?: string;
  error?: string;
  className?: string;
}

export const MemoizedSelect = memo<MemoizedSelectProps>(({
  label,
  value,
  onChange,
  options,
  helperText,
  error,
  className = ''
}) => {
  return (
    <div className={className}>
      <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white ${error ? 'border-rose-400' : ''}`}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-[11px] text-rose-600 font-bold mt-1">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{helperText}</p>}
    </div>
  );
});
MemoizedSelect.displayName = 'MemoizedSelect';

interface MemoizedPasswordInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  isBn: boolean;
  disabled?: boolean;
}

export const MemoizedPasswordInput = memo(
  React.forwardRef<HTMLInputElement, MemoizedPasswordInputProps>(({
    label,
    value,
    onChange,
    error,
    placeholder,
    required = false,
    isBn,
    disabled = false
  }, ref) => {
    return (
      <div className="bg-teal-50/70 dark:bg-teal-950/30 p-3 rounded-2xl border border-teal-200/80 dark:border-teal-800/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block font-bold text-teal-950 dark:text-teal-200 text-xs">
            {label}{required ? ' *' : ''}
          </label>
          <span className="text-[10px] text-teal-700 dark:text-teal-400 bg-teal-100/70 dark:bg-teal-900/50 px-2 py-0.5 rounded-full font-bold">
            {isBn ? 'সরাসরি লগইনের জন্য' : 'For direct login'}
          </span>
        </div>
        <input
          ref={ref}
          type="text"
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border rounded-xl p-2.5 font-mono text-sm font-bold bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none ${error ? 'border-rose-400' : 'border-teal-200 dark:border-teal-800'}`}
        />
        {error && <p className="text-[11px] text-rose-600 font-bold mt-1">{error}</p>}
      </div>
    );
  })
);
MemoizedPasswordInput.displayName = 'MemoizedPasswordInput';

interface MemoizedRolePickerProps {
  label: string;
  helperText?: string;
  roleOptions: { key: UserRole; bn: string; en: string }[];
  primaryRole: UserRole;
  selectedRoles: UserRole[];
  onToggleRole: (role: UserRole) => void;
  isBn: boolean;
}

export const MemoizedRolePicker = memo<MemoizedRolePickerProps>(({
  label,
  helperText,
  roleOptions,
  primaryRole,
  selectedRoles,
  onToggleRole,
  isBn
}) => {
  return (
    <div>
      <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {roleOptions
          .filter(opt => opt.key !== primaryRole)
          .map(opt => {
            const isSelected = selectedRoles.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onToggleRole(opt.key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {isSelected && <Check size={12} className="stroke-[3]" />}
                <span>{isBn ? opt.bn : opt.en}</span>
              </button>
            );
          })}
      </div>
      {helperText && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{helperText}</p>}
    </div>
  );
});
MemoizedRolePicker.displayName = 'MemoizedRolePicker';

interface MemoizedClassPickerProps {
  label: string;
  helperText?: string;
  classes: SchoolClass[];
  selectedClasses: string[];
  onToggleClass: (className: string) => void;
  isBn: boolean;
}

export const MemoizedClassPicker = memo<MemoizedClassPickerProps>(({
  label,
  helperText,
  classes,
  selectedClasses,
  onToggleClass,
  isBn
}) => {
  return (
    <div>
      <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl max-h-28 overflow-y-auto">
        {classes.length === 0 ? (
          <span className="text-slate-400 dark:text-slate-500 text-[11px] py-1">
            {isBn ? 'কোনো শ্রেণি তৈরি করা হয়নি' : 'No classes available'}
          </span>
        ) : (
          classes.map(c => {
            const isSelected = selectedClasses.includes(c.name);
            return (
              <button
                key={c.id || c.name}
                type="button"
                onClick={() => onToggleClass(c.name)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  isSelected 
                    ? 'bg-teal-600 text-white shadow-xs' 
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isSelected && <Check size={11} className="stroke-[3]" />}
                <span>{c.nameBn || c.name}</span>
              </button>
            );
          })
        )}
      </div>
      {helperText && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{helperText}</p>}
    </div>
  );
});
MemoizedClassPicker.displayName = 'MemoizedClassPicker';

// ============================================================================
// Main StaffEditModal Component
// ============================================================================

export const StaffEditModal: React.FC<StaffEditModalProps> = memo(({
  isOpen,
  onClose,
  editingTeacher,
  classes = [],
  unifiedStaffList = [],
  users = [],
  canCreateStaff,
  isBn,
  defaultEmployeeCode = '',
  initialLoginRole = 'teacher',
  initialAdditionalRoles = [],
  onSave
}) => {
  // Localized form state to prevent re-rendering the massive StaffManager parent
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [formDesignationSelect, setFormDesignationSelect] = useState<string>(DESIGNATION_OPTIONS[0].value);
  const [formLoginRole, setFormLoginRole] = useState<UserRole>('teacher');
  const [formAdditionalRoles, setFormAdditionalRoles] = useState<UserRole[]>([]);
  const [status, setStatus] = useState<AcademicTeacher['status']>('ACTIVE');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);

  const [formErrors, setFormErrors] = useState<{
    employeeCode?: string;
    email?: string;
    phone?: string;
    password?: string;
    designation?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field refs for quick error autofocus
  const employeeCodeInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const designationInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset state when modal opens or editingTeacher changes
  useEffect(() => {
    if (!isOpen) return;

    if (editingTeacher) {
      setName(editingTeacher.name || '');
      setNameBn(editingTeacher.nameBn || editingTeacher.name || '');
      setEmployeeCode(editingTeacher.employeeCode || '');
      const rawDesig = editingTeacher.designation || '';
      setDesignation(rawDesig);
      if (rawDesig && isMappedDesignation(rawDesig)) {
        setFormDesignationSelect(rawDesig);
      } else if (rawDesig) {
        setFormDesignationSelect(DESIGNATION_OTHER);
      } else {
        setFormDesignationSelect(DESIGNATION_OPTIONS[0].value);
      }

      setFormLoginRole(initialLoginRole);
      setFormAdditionalRoles(initialAdditionalRoles.filter(r => r !== initialLoginRole));
      setStatus(editingTeacher.status || 'ACTIVE');
      setPhone(editingTeacher.phone || '');
      setEmail(editingTeacher.email || '');
      setPassword(''); // Blank keeps existing password
      setAssignedClasses(editingTeacher.assignedClasses || []);
      setAssignedSubjects(editingTeacher.assignedSubjects || []);
    } else {
      setName('');
      setNameBn('');
      setEmployeeCode(defaultEmployeeCode);
      const defaultDesig = DESIGNATION_OPTIONS[0].value;
      setFormDesignationSelect(defaultDesig);
      setDesignation(defaultDesig);
      setFormLoginRole('teacher');
      setFormAdditionalRoles([]);
      setStatus('ACTIVE');
      setPhone('');
      setEmail('');
      setPassword('');
      setAssignedClasses([]);
      setAssignedSubjects([]);
    }

    setFormErrors({});
    setIsSubmitting(false);
  }, [isOpen, editingTeacher, defaultEmployeeCode, initialLoginRole, initialAdditionalRoles]);

  // Controlled state updates using useCallback for stable event handlers
  const handleNameBnChange = useCallback((val: string) => {
    setNameBn(val);
    setName(val);
  }, []);

  const handleDesignationSelectChange = useCallback((val: string) => {
    setFormDesignationSelect(val);
    setFormErrors(prev => ({ ...prev, designation: undefined }));
    if (val === DESIGNATION_OTHER) {
      setDesignation('');
      setTimeout(() => designationInputRef.current?.focus(), 50);
    } else {
      setDesignation(val);
      const matched = DESIGNATION_OPTIONS.find(o => o.value === val);
      if (matched) {
        setFormLoginRole(matched.role);
      }
    }
  }, []);

  const handleCustomDesignationChange = useCallback((val: string) => {
    setDesignation(val);
    setFormErrors(prev => (prev.designation ? { ...prev, designation: undefined } : prev));
  }, []);

  const handleEmployeeCodeChange = useCallback((val: string) => {
    setEmployeeCode(val);
    setFormErrors(prev => (prev.employeeCode ? { ...prev, employeeCode: undefined } : prev));
  }, []);

  const handlePhoneChange = useCallback((val: string) => {
    setPhone(val);
    setFormErrors(prev => (prev.phone ? { ...prev, phone: undefined } : prev));
  }, []);

  const handleEmailChange = useCallback((val: string) => {
    setEmail(val);
    setFormErrors(prev => (prev.email ? { ...prev, email: undefined } : prev));
  }, []);

  const handlePasswordChange = useCallback((val: string) => {
    setPassword(val);
    setFormErrors(prev => (prev.password ? { ...prev, password: undefined } : prev));
  }, []);

  const handleLoginRoleChange = useCallback((val: string) => {
    setFormLoginRole(val as UserRole);
  }, []);

  const handleStatusChange = useCallback((val: string) => {
    setStatus(val as AcademicTeacher['status']);
  }, []);

  const handleToggleClass = useCallback((className: string) => {
    setAssignedClasses(prev =>
      prev.includes(className) ? prev.filter(c => c !== className) : [...prev, className]
    );
  }, []);

  const handleToggleAdditionalRole = useCallback((role: UserRole) => {
    setFormAdditionalRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingTeacher && !canCreateStaff) {
      setFormErrors({ employeeCode: isBn ? 'শুধু সুপার অ্যাডমিন ও অধ্যক্ষ নতুন অ্যাকাউন্ট তৈরি করতে পারবেন' : 'Only super admin and principal can create new accounts' });
      return;
    }

    if (!name.trim() && !nameBn.trim()) {
      return;
    }

    if (formDesignationSelect === DESIGNATION_OTHER && !designation.trim()) {
      setFormErrors(prev => ({
        ...prev,
        designation: isBn ? 'অন্যান্য পদবি লিখুন অথবা তালিকা থেকে বাছুন' : 'Type the custom designation or pick from the list'
      }));
      designationInputRef.current?.focus();
      return;
    }

    const code = employeeCode.trim();
    const emailVal = email.trim();
    const phoneVal = phone.trim();
    const phoneDigits = phoneVal.replace(/[^0-9]/g, '');
    const fieldErrs: { employeeCode?: string; email?: string; phone?: string; password?: string; designation?: string } = {};

    if (code) {
      const dup = unifiedStaffList.some(s =>
        s.id !== editingTeacher?.id &&
        (s.employeeCode || '').trim().toLowerCase() === code.toLowerCase()
      );
      if (dup) {
        fieldErrs.employeeCode = isBn ? 'এই কর্মী কোড ইতিমধ্যে ব্যবহৃত হয়েছে' : 'This employee code is already in use';
      }
    }

    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      fieldErrs.email = isBn ? 'সঠিক ইমেইল ঠিকানা দিন' : 'Enter a valid email address';
    }

    if (emailVal && !fieldErrs.email) {
      const dupEmail = unifiedStaffList.some(s =>
        s.id !== editingTeacher?.id &&
        (s.email || '').trim().toLowerCase() === emailVal.toLowerCase()
      ) || users.some(u =>
        u.id !== editingTeacher?.id &&
        (u.email || '').trim().toLowerCase() === emailVal.toLowerCase()
      );
      if (dupEmail) {
        fieldErrs.email = isBn ? 'এই ইমেইল ইতিমধ্যে অন্য স্টাফের সাথে যুক্ত আছে' : 'This email is already linked to another staff member';
      }
    }

    if (phoneVal) {
      if (!(phoneDigits.length === 11 && phoneDigits.startsWith('01'))) {
        fieldErrs.phone = isBn ? 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (01XXXXXXXXX)' : 'Enter a valid 11-digit mobile number (01XXXXXXXXX)';
      } else {
        const dupPhone = unifiedStaffList.some(s =>
          s.id !== editingTeacher?.id &&
          (s.phone || '').replace(/[^0-9]/g, '') === phoneDigits
        ) || users.some(u =>
          u.id !== editingTeacher?.id &&
          (u.phone || '').replace(/[^0-9]/g, '') === phoneDigits
        );
        if (dupPhone) {
          fieldErrs.phone = isBn ? 'এই মোবাইল নম্বর ইতিমধ্যে অন্য স্টাফের সাথে যুক্ত আছে' : 'This phone number is already linked to another staff member';
        }
      }
    }

    if (!emailVal && !phoneVal) {
      fieldErrs.email = isBn ? 'লগইনের জন্য ইমেইল বা মোবাইল — অন্তত একটি দিন' : 'Provide an email or a phone number for login';
    }

    const typedPasswordEarly = password.trim();
    if ((!editingTeacher && typedPasswordEarly.length < 6) || (editingTeacher && typedPasswordEarly && typedPasswordEarly.length < 6)) {
      fieldErrs.password = isBn ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters';
    }

    if (Object.keys(fieldErrs).length > 0) {
      setFormErrors(fieldErrs);
      if (fieldErrs.employeeCode) employeeCodeInputRef.current?.focus();
      else if (fieldErrs.email) emailInputRef.current?.focus();
      else if (fieldErrs.phone) phoneInputRef.current?.focus();
      else if (fieldErrs.password) passwordInputRef.current?.focus();
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const res = await onSave({
        teacherData: {
          name: name.trim() || nameBn.trim(),
          nameBn: nameBn.trim() || name.trim(),
          employeeCode: code || defaultEmployeeCode,
          designation: (formDesignationSelect === DESIGNATION_OTHER ? designation.trim() : formDesignationSelect) || 'সহকারী শিক্ষক',
          phone: phoneVal,
          email: emailVal,
          password: typedPasswordEarly,
          status,
          assignedClasses,
          assignedSubjects
        },
        loginRole: formLoginRole,
        additionalRoles: formAdditionalRoles.filter(r => r !== formLoginRole),
        isEditing: !!editingTeacher
      });

      if (!res.success) {
        if (res.fieldErrors) {
          setFormErrors(res.fieldErrors);
          if (res.fieldErrors.employeeCode) employeeCodeInputRef.current?.focus();
          else if (res.fieldErrors.email) emailInputRef.current?.focus();
          else if (res.fieldErrors.phone) phoneInputRef.current?.focus();
          else if (res.fieldErrors.password) passwordInputRef.current?.focus();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Prepared option sets for memoized selects
  const designationSelectOptions = [
    ...DESIGNATION_OPTIONS.map(o => ({ value: o.value, label: o.labelBn })),
    ...(!DESIGNATION_OPTIONS.some(o => o.value === formDesignationSelect) && formDesignationSelect !== DESIGNATION_OTHER
      ? [{ value: formDesignationSelect, label: formDesignationSelect }]
      : []),
    { value: DESIGNATION_OTHER, label: isBn ? 'অন্যান্য (নিজে লিখুন)' : 'Other (type below)' }
  ];

  const roleSelectOptions = [
    { value: 'teacher', label: isBn ? 'শিক্ষক (Teacher)' : 'Teacher' },
    { value: 'accountant', label: isBn ? 'হিসাবরক্ষক / ক্যাশিয়ার (Accountant)' : 'Accountant / Cashier' },
    { value: 'staff', label: isBn ? 'অফিস স্টাফ (Office Staff)' : 'Office Staff' },
    { value: 'principal', label: isBn ? 'অধ্যক্ষ (Principal)' : 'Principal' },
    { value: 'guardian', label: isBn ? 'অভিভাবক (Guardian)' : 'Guardian' }
  ];

  const statusSelectOptions = [
    { value: 'ACTIVE', label: isBn ? 'সক্রিয় (Active)' : 'Active' },
    { value: 'INACTIVE', label: isBn ? 'নিষ্ক্রিয় / সাবেক (Inactive)' : 'Inactive' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
        style={{ transform: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 shrink-0">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
            {editingTeacher ? (
              <Edit2 size={18} className="text-teal-600 dark:text-teal-400" />
            ) : (
              <UserPlus size={18} className="text-teal-600 dark:text-teal-400" />
            )}
            <span>
              {editingTeacher
                ? (isBn ? 'শিক্ষক/কর্মী তথ্য সম্পাদনা' : 'Edit Staff')
                : (isBn ? 'নতুন শিক্ষক/কর্মচারী নিবন্ধন' : 'Add New Staff')}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body with Memoized Input Fields */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs custom-scrollbar">
          {/* Bengali Name (Memoized) */}
          <MemoizedTextInput
            label={isBn ? 'পূর্ণ নাম (বাংলা):' : 'Full Name (Bangla):'}
            required
            placeholder="যেমন: মাওলানা মাহমুদ হাসান"
            value={nameBn}
            onChange={handleNameBnChange}
          />

          {/* Designation & Employee Code (Memoized) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <MemoizedSelect
                label={isBn ? 'পদবি (Designation):' : 'Designation:'}
                value={formDesignationSelect}
                onChange={handleDesignationSelectChange}
                options={designationSelectOptions}
                error={formErrors.designation}
              />

              {formDesignationSelect === DESIGNATION_OTHER && (
                <MemoizedTextInput
                  ref={designationInputRef}
                  label={isBn ? 'কাস্টম পদবি:' : 'Custom Designation:'}
                  placeholder="যেমন: আরবি প্রভাষক"
                  value={designation}
                  onChange={handleCustomDesignationChange}
                  error={formErrors.designation}
                  className="mt-2"
                />
              )}
            </div>

            <MemoizedTextInput
              ref={employeeCodeInputRef}
              label={isBn ? 'আইডি / কোড:' : 'Employee Code:'}
              placeholder="MDR-T001"
              value={employeeCode}
              onChange={handleEmployeeCodeChange}
              error={formErrors.employeeCode}
              mono
            />
          </div>

          {/* Primary Login Role (Memoized) */}
          <MemoizedSelect
            label={isBn ? 'লগইন রোল (Login Role):' : 'Login Role:'}
            value={formLoginRole}
            onChange={handleLoginRoleChange}
            options={roleSelectOptions}
            helperText={isBn
              ? 'উনি এই রোলেই লগইন করে নিজের পোর্টাল দেখবেন। তালিকা থেকে পদবি বাছলে রোল নিজে থেকে মিলে যায়; অন্যান্য পদবির ক্ষেত্রে এই রোলই চূড়ান্ত।'
              : 'They will log in with this role and see that portal. Picking a listed designation sets this role; for a custom title, this pick is final.'}
          />

          {/* Additional Roles (Multi-Role) (Memoized) */}
          <MemoizedRolePicker
            label={isBn ? 'অতিরিক্ত রোল (যদি থাকে):' : 'Additional Role(s), if any:'}
            helperText={isBn
              ? 'একজন একসাথে দুটি দায়িত্ব পালন করলে (যেমন হিসাবরক্ষক + শিক্ষক) অতিরিক্ত রোলটি টিক দিন — তিনি সব রোলের অ্যাক্সেসই পাবেন।'
              : 'If one person holds two duties at once (e.g. accountant + teacher), tick the extra role — they get the access of every role they hold.'}
            roleOptions={ROLE_OPTIONS}
            primaryRole={formLoginRole}
            selectedRoles={formAdditionalRoles}
            onToggleRole={handleToggleAdditionalRole}
            isBn={isBn}
          />

          {/* Status (Memoized) */}
          <MemoizedSelect
            label={isBn ? 'স্ট্যাটাস (Status):' : 'Status:'}
            value={status || 'ACTIVE'}
            onChange={handleStatusChange}
            options={statusSelectOptions}
            helperText={isBn
              ? 'নিষ্ক্রিয় করলে উনি তালিকায় থাকবেন কিন্তু সাবেক হিসেবে চিহ্নিত হবেন।'
              : 'Inactive keeps the record, marked as former.'}
          />

          {/* Contact (Phone & Email) (Memoized) */}
          <div className="grid grid-cols-2 gap-3">
            <MemoizedTextInput
              ref={phoneInputRef}
              label={isBn ? 'মোবাইল নম্বর:' : 'Phone:'}
              type="tel"
              placeholder="017xxxxxxxx"
              value={phone}
              onChange={handlePhoneChange}
              error={formErrors.phone}
            />

            <MemoizedTextInput
              ref={emailInputRef}
              label={isBn ? 'ইমেইল:' : 'Email:'}
              type="email"
              placeholder="teacher@madrasha.edu.bd"
              value={email}
              onChange={handleEmailChange}
              error={formErrors.email}
            />
          </div>

          {/* Login Password (Memoized) */}
          <MemoizedPasswordInput
            ref={passwordInputRef}
            label={isBn ? 'লগইন পাসওয়ার্ড (Login Password):' : 'Login Password:'}
            required={!editingTeacher}
            placeholder={editingTeacher ? (isBn ? 'ফাঁকা রাখলে আগের পাসওয়ার্ড থাকবে' : 'Leave blank to keep the old password') : (isBn ? 'পাসওয়ার্ড দিন' : 'Enter a password')}
            value={password}
            onChange={handlePasswordChange}
            error={formErrors.password}
            isBn={isBn}
          />

          {/* Assigned Classes (Memoized) */}
          <MemoizedClassPicker
            label={isBn ? 'দায়িত্বপ্রাপ্ত শ্রেণি (Assigned Classes - শ্রেণি শিক্ষক):' : 'Assigned Class(es):'}
            helperText={isBn ? 'শ্রেণি শিক্ষক হিসেবে নির্বাচিত শ্রেণির শিক্ষার্থী ও বকেয়া ফি এই শিক্ষক দেখতে পাবেন।' : 'Teacher will see students and dues for selected classes.'}
            classes={classes}
            selectedClasses={assignedClasses}
            onToggleClass={handleToggleClass}
            isBn={isBn}
          />

          {/* Sticky footer actions */}
          <div className="sticky bottom-0 bg-white dark:bg-slate-900 flex justify-end gap-2 pt-3 pb-1 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>{editingTeacher ? (isBn ? 'তথ্য আপডেট করুন' : 'Update Staff') : (isBn ? 'সংরক্ষণ করুন' : 'Save Staff')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

StaffEditModal.displayName = 'StaffEditModal';
