import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Package,
  Layers,
  Shield,
  HeartPulse,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Printer,
  QrCode,
  Calendar,
  UserCheck,
  Users,
  Award,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  Sparkles,
  Download,
  FileText,
  Phone,
  Mail,
  MapPin,
  Tag,
  Activity,
  Building2,
  Boxes,
  GraduationCap
} from 'lucide-react';
import { formatNumber } from '../../services/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export type OperationsSubTab =
  | 'fixed_assets'
  | 'store_inventory'
  | 'house_system'
  | 'fuzala_alumni'
  | 'health_medical';

interface InstitutionalOperationsManagerProps {
  initialSubTab?: OperationsSubTab;
  onNavigateTab?: (tab: string) => void;
}

// 1. Fixed Asset Types
interface FixedAsset {
  id: string;
  assetCode: string;
  name: string;
  nameEn: string;
  category: 'furniture' | 'electronics' | 'sound_system' | 'campus_facility' | 'lab_kitab';
  location: string;
  purchaseDate: string;
  cost: number;
  condition: 'operational' | 'maintenance' | 'disposed';
  assignedTo?: string;
  notes?: string;
}

// 2. Store Inventory Item
interface StoreItem {
  id: string;
  itemCode: string;
  name: string;
  nameEn: string;
  category: 'stationery' | 'exam_supplies' | 'office' | 'cleaning_hygiene' | 'hospitality';
  unit: string;
  unitEn: string;
  currentStock: number;
  minThreshold: number;
  unitPrice: number;
  lastRestockedDate: string;
}

interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: 'in' | 'out';
  quantity: number;
  recipientOrVendor: string;
  date: string;
  approvedBy: string;
  notes?: string;
}

// 3. House System Types
interface HouseWing {
  id: string;
  code: string;
  nameBn: string;
  nameEn: string;
  colorHex: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  houseMaster: string;
  prefect: string;
  memberCount: number;
  points: number;
  rank: number;
  motto: string;
}

interface HousePointLog {
  id: string;
  houseId: string;
  houseName: string;
  change: number; // positive or negative
  category: 'discipline' | 'cleanliness' | 'quran_hifz' | 'debate_culture' | 'sports';
  reason: string;
  awardedBy: string;
  date: string;
}

// 4. Alumni & Fuzala
interface AlumniMember {
  id: string;
  regId: string;
  name: string;
  nameEn: string;
  graduationYear: string;
  batchOrSanad: string;
  currentDesignation: string;
  institutionOrOrg: string;
  mobile: string;
  email: string;
  district: string;
  membershipType: 'general' | 'lifetime' | 'patron';
  totalDonation: number;
  bloodGroup: string;
}

// 5. Medical & Health Record
interface HealthRecord {
  id: string;
  date: string;
  studentName: string;
  studentRoll: string;
  className: string;
  symptoms: string;
  temperature?: string;
  bloodGroup: string;
  medicationGiven: string;
  actionTaken: 'hostel_rest' | 'returned_class' | 'referred_hospital' | 'guardian_informed';
  attendingStaff: string;
  guardianPhone: string;
  resolved: boolean;
}

const STORAGE_KEY = 'mms_institutional_operations_suite_v1';

export const InstitutionalOperationsManager: React.FC<InstitutionalOperationsManagerProps> = ({
  initialSubTab = 'fixed_assets',
  onNavigateTab
}) => {
  const { language, schoolProfile } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<OperationsSubTab>(initialSubTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedAssetForPrint, setSelectedAssetForPrint] = useState<FixedAsset | null>(null);
  const [selectedAlumniForPrint, setSelectedAlumniForPrint] = useState<AlumniMember | null>(null);
  const [selectedHealthForPrint, setSelectedHealthForPrint] = useState<HealthRecord | null>(null);

  // Modals state
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [showHousePointModal, setShowHousePointModal] = useState(false);
  const [showAddAlumniModal, setShowAddAlumniModal] = useState(false);
  const [showAddHealthModal, setShowAddHealthModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Delete confirmation (assets / alumni / health logs) via ConfirmDialog
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'asset' | 'alumni' | 'health'; id: string; message: string } | null>(null);

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'asset') {
      setAssets(prev => prev.filter(a => a.id !== pendingDelete.id));
      showToast(language === 'bn' ? 'সম্পদ অপসারণ করা হয়েছে।' : 'Asset removed.');
    } else if (pendingDelete.kind === 'alumni') {
      setAlumni(prev => prev.filter(a => a.id !== pendingDelete.id));
      showToast(language === 'bn' ? 'অ্যালামনাই রেকর্ড অপসারিত।' : 'Record removed.');
    } else {
      setHealthRecords(prev => prev.filter(h => h.id !== pendingDelete.id));
      showToast(language === 'bn' ? 'চিকিৎসা লগ ডিলিট হয়েছে।' : 'Log deleted.');
    }
    setPendingDelete(null);
  };

  // 1. Initial State Seed (Clean Empty States)
  const [assets, setAssets] = useState<FixedAsset[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_assets`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(a => !a?.id?.startsWith('ast-'));
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [storeItems, setStoreItems] = useState<StoreItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_store`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(s => !s?.id?.startsWith('itm-'));
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [movements, setMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_movements`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(m => !m?.id?.startsWith('mov-'));
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [houses, setHouses] = useState<HouseWing[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_houses`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(h => !h?.id?.startsWith('house-'));
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [housePointLogs, setHousePointLogs] = useState<HousePointLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_house_logs`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(l => !l?.id?.startsWith('hpl-'));
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [alumni, setAlumni] = useState<AlumniMember[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_alumni`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(a => !a?.id?.startsWith('alm-'));
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_health`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(h => !h?.id?.startsWith('hlth-'));
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  // Persist
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_assets`, JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_store`, JSON.stringify(storeItems));
  }, [storeItems]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_movements`, JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_houses`, JSON.stringify(houses));
  }, [houses]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_house_logs`, JSON.stringify(housePointLogs));
  }, [housePointLogs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_alumni`, JSON.stringify(alumni));
  }, [alumni]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_health`, JSON.stringify(healthRecords));
  }, [healthRecords]);

  // Derived Metrics
  const totalAssetCost = useMemo(() => assets.reduce((sum, a) => sum + (a.cost || 0), 0), [assets]);
  const operationalAssetCount = useMemo(() => assets.filter(a => a.condition === 'operational').length, [assets]);
  const lowStockCount = useMemo(() => storeItems.filter(i => i.currentStock <= i.minThreshold).length, [storeItems]);
  const totalAlumniDonation = useMemo(() => alumni.reduce((sum, a) => sum + (a.totalDonation || 0), 0), [alumni]);
  const activeUnresolvedPatients = useMemo(() => healthRecords.filter(h => !h.resolved).length, [healthRecords]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchSearch =
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.assetCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = categoryFilter === 'ALL' || a.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [assets, searchTerm, categoryFilter]);

  // Filtered Store
  const filteredStoreItems = useMemo(() => {
    return storeItems.filter(i => {
      const matchSearch =
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.nameEn.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = categoryFilter === 'ALL' || i.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [storeItems, searchTerm, categoryFilter]);

  // Filtered Alumni
  const filteredAlumni = useMemo(() => {
    return alumni.filter(a => {
      return (
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.regId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.currentDesignation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.graduationYear.includes(searchTerm)
      );
    });
  }, [alumni, searchTerm]);

  // Filtered Health
  const filteredHealth = useMemo(() => {
    return healthRecords.filter(h => {
      return (
        h.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.studentRoll.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.symptoms.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [healthRecords, searchTerm]);

  // Form states
  const [newAsset, setNewAsset] = useState<Partial<FixedAsset>>({
    category: 'furniture',
    condition: 'operational',
    purchaseDate: new Date().toISOString().split('T')[0]
  });

  const [stockEntry, setStockEntry] = useState<{
    itemId: string;
    quantity: number;
    recipientOrVendor: string;
    approvedBy: string;
    notes: string;
  }>({
    itemId: storeItems[0]?.id || '',
    quantity: 1,
    recipientOrVendor: '',
    approvedBy: '',
    notes: ''
  });

  const [housePointForm, setHousePointForm] = useState<{
    houseId: string;
    change: number;
    category: 'discipline' | 'cleanliness' | 'quran_hifz' | 'debate_culture' | 'sports';
    reason: string;
    awardedBy: string;
  }>({
    houseId: houses[0]?.id || '',
    change: 10,
    category: 'discipline',
    reason: '',
    awardedBy: ''
  });

  const [newAlumni, setNewAlumni] = useState<Partial<AlumniMember>>({
    membershipType: 'general',
    graduationYear: '২০২৪',
    bloodGroup: 'B+',
    totalDonation: 0
  });

  const [newHealthRecord, setNewHealthRecord] = useState<Partial<HealthRecord>>({
    date: new Date().toISOString().split('T')[0],
    bloodGroup: 'O+',
    actionTaken: 'hostel_rest',
    resolved: false
  });

  // Actions
  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.name || !newAsset.location) {
      showToast(language === 'bn' ? 'দয়া করে নাম এবং অবস্থান প্রদান করুন' : 'Please provide asset name and location');
      return;
    }
    const created: FixedAsset = {
      id: `ast-${Date.now()}`,
      assetCode: newAsset.assetCode || `AST-${new Date().getFullYear()}-${String(assets.length + 1).padStart(3, '0')}`,
      name: newAsset.name,
      nameEn: newAsset.nameEn || newAsset.name,
      category: (newAsset.category as any) || 'furniture',
      location: newAsset.location,
      purchaseDate: newAsset.purchaseDate || new Date().toISOString().split('T')[0],
      cost: Number(newAsset.cost) || 0,
      condition: (newAsset.condition as any) || 'operational',
      assignedTo: newAsset.assignedTo || '',
      notes: newAsset.notes || ''
    };

    setAssets(prev => [created, ...prev]);
    setShowAddAssetModal(false);
    setNewAsset({ category: 'furniture', condition: 'operational', purchaseDate: new Date().toISOString().split('T')[0] });
    showToast(language === 'bn' ? 'নতুন স্থায়ী সম্পদ সফলভাবে নিবন্ধিত হয়েছে!' : 'Asset registered successfully!');
  };

  const handleStockIn = (e: React.FormEvent) => {
    e.preventDefault();
    const item = storeItems.find(i => i.id === stockEntry.itemId);
    if (!item || stockEntry.quantity <= 0) return;

    setStoreItems(prev =>
      prev.map(i =>
        i.id === item.id
          ? { ...i, currentStock: i.currentStock + stockEntry.quantity, lastRestockedDate: new Date().toISOString().split('T')[0] }
          : i
      )
    );

    const mov: StockMovement = {
      id: `mov-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      type: 'in',
      quantity: stockEntry.quantity,
      recipientOrVendor: stockEntry.recipientOrVendor || (language === 'bn' ? 'স্থানীয় ভেন্ডর / সরবরাহকারী' : 'Local Vendor'),
      date: new Date().toISOString().split('T')[0],
      approvedBy: stockEntry.approvedBy || (language === 'bn' ? 'স্টোর ইনচার্জ' : 'Store In-Charge'),
      notes: stockEntry.notes
    };
    setMovements(prev => [mov, ...prev]);
    setShowStockInModal(false);
    showToast(language === 'bn' ? `স্টক ইন সফল! ${item.name} বৃদ্ধি পেয়েছে।` : 'Stock added successfully!');
  };

  const handleStockOut = (e: React.FormEvent) => {
    e.preventDefault();
    const item = storeItems.find(i => i.id === stockEntry.itemId);
    if (!item || stockEntry.quantity <= 0) return;

    if (item.currentStock < stockEntry.quantity) {
      showToast(language === 'bn' ? 'পর্যাপ্ত স্টক নেই!' : 'Insufficient stock available!');
      return;
    }

    setStoreItems(prev =>
      prev.map(i =>
        i.id === item.id
          ? { ...i, currentStock: i.currentStock - stockEntry.quantity }
          : i
      )
    );

    const mov: StockMovement = {
      id: `mov-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      type: 'out',
      quantity: stockEntry.quantity,
      recipientOrVendor: stockEntry.recipientOrVendor || (language === 'bn' ? 'শিক্ষক / জামাত প্রতিনিধি' : 'Staff / Class'),
      date: new Date().toISOString().split('T')[0],
      approvedBy: stockEntry.approvedBy || (language === 'bn' ? 'নাযেম-ই তালিমাত' : 'Academic In-Charge'),
      notes: stockEntry.notes
    };
    setMovements(prev => [mov, ...prev]);
    setShowStockOutModal(false);
    showToast(language === 'bn' ? `স্টক বিতরণ সম্পন্ন! ${item.name} ইস্যু করা হয়েছে।` : 'Item distributed successfully!');
  };

  const handleAwardHousePoints = (e: React.FormEvent) => {
    e.preventDefault();
    const house = houses.find(h => h.id === housePointForm.houseId);
    if (!house || !housePointForm.reason) return;

    const newPoints = Math.max(0, house.points + Number(housePointForm.change));

    // Update houses and ranks
    const updatedHouses = houses.map(h => (h.id === house.id ? { ...h, points: newPoints } : h));
    // Sort and re-assign ranks
    updatedHouses.sort((a, b) => b.points - a.points);
    const rankedHouses = updatedHouses.map((h, idx) => ({ ...h, rank: idx + 1 }));

    setHouses(rankedHouses);

    const log: HousePointLog = {
      id: `hpl-${Date.now()}`,
      houseId: house.id,
      houseName: house.nameBn,
      change: Number(housePointForm.change),
      category: housePointForm.category,
      reason: housePointForm.reason,
      awardedBy: housePointForm.awardedBy || (language === 'bn' ? 'অধ্যক্ষ / বিচারক প্যানেল' : 'Principal / Jury'),
      date: new Date().toISOString().split('T')[0]
    };
    setHousePointLogs(prev => [log, ...prev]);
    setShowHousePointModal(false);
    showToast(language === 'bn' ? `${house.nameBn}-কে পয়েন্ট আপডেট সফল হয়েছে!` : 'House points updated!');
  };

  const handleAddAlumni = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlumni.name || !newAlumni.mobile) {
      showToast(language === 'bn' ? 'নাম এবং মোবাইল নম্বর বাধ্যতামূলক' : 'Name and phone required');
      return;
    }

    const created: AlumniMember = {
      id: `alm-${Date.now()}`,
      regId: `ALM-${newAlumni.graduationYear || '2025'}-${String(alumni.length + 1).padStart(3, '0')}`,
      name: newAlumni.name,
      nameEn: newAlumni.nameEn || newAlumni.name,
      graduationYear: newAlumni.graduationYear || '২০২৪',
      batchOrSanad: newAlumni.batchOrSanad || (language === 'bn' ? 'দাখিল / আলিম' : 'Dakhil / Alim'),
      currentDesignation: newAlumni.currentDesignation || (language === 'bn' ? 'মুদাররিস / ইমাম' : 'Teacher / Imam'),
      institutionOrOrg: newAlumni.institutionOrOrg || '',
      mobile: newAlumni.mobile,
      email: newAlumni.email || '',
      district: newAlumni.district || (language === 'bn' ? 'ঢাকা' : 'Dhaka'),
      membershipType: (newAlumni.membershipType as any) || 'general',
      totalDonation: Number(newAlumni.totalDonation) || 0,
      bloodGroup: newAlumni.bloodGroup || 'B+'
    };

    setAlumni(prev => [created, ...prev]);
    setShowAddAlumniModal(false);
    setNewAlumni({ membershipType: 'general', graduationYear: '২০২৪', bloodGroup: 'B+', totalDonation: 0 });
    showToast(language === 'bn' ? 'অ্যালামনাই প্রোফাইল যুক্ত হয়েছে!' : 'Alumni record created!');
  };

  const handleAddHealth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHealthRecord.studentName || !newHealthRecord.symptoms) {
      showToast(language === 'bn' ? 'শিক্ষার্থীর নাম ও লক্ষণ উল্লেখ করুন' : 'Provide student name and symptoms');
      return;
    }

    const created: HealthRecord = {
      id: `hlth-${Date.now()}`,
      date: newHealthRecord.date || new Date().toISOString().split('T')[0],
      studentName: newHealthRecord.studentName,
      studentRoll: newHealthRecord.studentRoll || 'N/A',
      className: newHealthRecord.className || (language === 'bn' ? 'হেফজ জামাত' : 'Hifz Class'),
      symptoms: newHealthRecord.symptoms,
      temperature: newHealthRecord.temperature,
      bloodGroup: newHealthRecord.bloodGroup || 'O+',
      medicationGiven: newHealthRecord.medicationGiven || (language === 'bn' ? 'প্রাথমিক স্যালাইন ও বিশ্রাম' : 'First Aid & Rest'),
      actionTaken: (newHealthRecord.actionTaken as any) || 'hostel_rest',
      attendingStaff: newHealthRecord.attendingStaff || (language === 'bn' ? 'হোস্টেল ইনচার্জ' : 'Hostel Incharge'),
      guardianPhone: newHealthRecord.guardianPhone || '',
      resolved: false
    };

    setHealthRecords(prev => [created, ...prev]);
    setShowAddHealthModal(false);
    setNewHealthRecord({ date: new Date().toISOString().split('T')[0], bloodGroup: 'O+', actionTaken: 'hostel_rest', resolved: false });
    showToast(language === 'bn' ? 'চিকিৎসা লগ সফলভাবে সংরক্ষিত হয়েছে!' : 'Health incident recorded!');
  };

  const toggleHealthResolved = (id: string) => {
    setHealthRecords(prev =>
      prev.map(h => (h.id === id ? { ...h, resolved: !h.resolved } : h))
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${language === 'bn' ? 'font-bangla' : ''}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-800 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-2 border border-emerald-600 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span className="font-semibold text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Package className="w-8 h-8 text-indigo-400" />
              <span>
                {language === 'bn'
                  ? 'সম্পদ, ইনভেন্টরি, হাউজ সিস্টেম ও অ্যালামনাই হাব'
                  : 'Assets, Store, House Wings & Alumni Suite'}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>{language === 'bn' ? 'প্রতিবেদন প্রিন্ট' : 'Print Report'}</span>
            </button>
            <div className="bg-indigo-600/30 border border-indigo-400/40 px-3.5 py-2 rounded-xl text-center">
              <span className="block text-2xs text-indigo-200 uppercase font-bold tracking-wider">
                {language === 'bn' ? 'মোট সম্পদ মূল্য' : 'Asset Valuation'}
              </span>
              <span className="text-base font-black text-white">৳{formatNumber(totalAssetCost, language)}</span>
            </div>
          </div>
        </div>

        {/* Global Key Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-2xs text-slate-400 dark:text-slate-500 block">{language === 'bn' ? 'সচল স্থায়ী সম্পদ' : 'Active Fixed Assets'}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-black text-white">{formatNumber(operationalAssetCount, language)} টি</span>
              <span className="text-xs text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/50">
                {assets.length} {language === 'bn' ? 'মোট' : 'Total'}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-2xs text-slate-400 dark:text-slate-500 block">{language === 'bn' ? 'স্টোর লো-স্টক সতর্কতা' : 'Low Stock Alerts'}</span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xl font-black ${lowStockCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                {formatNumber(lowStockCount, language)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${lowStockCount > 0 ? 'bg-amber-950/50 text-amber-300 border-amber-800/50' : 'bg-slate-700/50 text-slate-300 border-slate-600'}`}>
                {storeItems.length} {language === 'bn' ? 'পণ্য' : 'Items'}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-2xs text-slate-400 dark:text-slate-500 block">{language === 'bn' ? 'নিবন্ধিত প্রাক্তন শিক্ষার্থী (অ্যালামনাই)' : 'Registered Alumni'}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-black text-white">{formatNumber(alumni.length, language)} জন</span>
              <span className="text-xs text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-800/50">
                ৳{formatNumber(totalAlumniDonation, language)}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <span className="text-2xs text-slate-400 dark:text-slate-500 block">{language === 'bn' ? 'চিকিৎসাধীন রোগী (সক্রিয়)' : 'Active Health Cases'}</span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xl font-black ${activeUnresolvedPatients > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatNumber(activeUnresolvedPatients, language)}
              </span>
              <span className="text-xs text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded-full border border-slate-600">
                {healthRecords.length} {language === 'bn' ? 'মোট রেকর্ড' : 'Logs'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Sub-Tab Switcher */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800">
        {[
          {
            id: 'fixed_assets' as OperationsSubTab,
            labelBn: 'স্থায়ী সম্পদ ও আসবাবপত্র',
            labelEn: 'Fixed Assets & Property',
            icon: Package,
            count: assets.length
          },
          {
            id: 'store_inventory' as OperationsSubTab,
            labelBn: 'স্টোর ইনভেন্টরি ও কনজিউমেবল',
            labelEn: 'Store Consumables & Stock',
            icon: Boxes,
            count: storeItems.length,
            badgeAlert: lowStockCount > 0
          },
          {
            id: 'house_system' as OperationsSubTab,
            labelBn: 'হাউজ সিস্টেম ও হোস্টেল উইং',
            labelEn: 'House Wings & Points',
            icon: Shield,
            count: houses.length
          },
          {
            id: 'fuzala_alumni' as OperationsSubTab,
            labelBn: 'প্রাক্তন শিক্ষার্থী (অ্যালামনাই)',
            labelEn: 'Alumni Association',
            icon: GraduationCap,
            count: alumni.length
          },
          {
            id: 'health_medical' as OperationsSubTab,
            labelBn: 'স্বাস্থ্যসেবা ও ফার্স্ট এইড লগ',
            labelEn: 'Health & Medical First Aid',
            icon: HeartPulse,
            count: healthRecords.length,
            badgeAlert: activeUnresolvedPatients > 0
          }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                setSearchTerm('');
                setCategoryFilter('ALL');
              }}
              className={`flex-1 min-w-[180px] flex items-center justify-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-200 shadow-md border border-indigo-100 dark:border-indigo-800 scale-[1.01]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <span>{language === 'bn' ? tab.labelBn : tab.labelEn}</span>
              <span
                className={`ml-1.5 px-2 py-0.5 text-2xs rounded-full font-bold ${
                  tab.badgeAlert
                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={
              language === 'bn'
                ? 'আইটেম কোড, নাম, কক্ষ বা বিবরণ দিয়ে খুঁজুন...'
                : 'Search by code, title, location, keywords...'
            }
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-800/50/50"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          {activeSubTab === 'fixed_assets' && (
            <>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">{language === 'bn' ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
                <option value="furniture">{language === 'bn' ? 'আসবাবপত্র ও ফার্নিচার' : 'Furniture'}</option>
                <option value="sound_system">{language === 'bn' ? 'সাউন্ড ও মাইক সিস্টেম' : 'Sound System'}</option>
                <option value="electronics">{language === 'bn' ? 'আইটি ও ইলেকট্রনিক্স' : 'Electronics & IT'}</option>
                <option value="campus_facility">{language === 'bn' ? 'ক্যাম্পাস ও হোস্টেল সরঞ্জাম' : 'Campus Facilities'}</option>
                <option value="lab_kitab">{language === 'bn' ? 'কুতুবখানা ও বুক র‍্যাক' : 'Library & Racks'}</option>
              </select>
              <button
                onClick={() => setShowAddAssetModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'bn' ? 'নতুন সম্পদ এন্ট্রি' : 'Add New Asset'}</span>
              </button>
            </>
          )}

          {activeSubTab === 'store_inventory' && (
            <>
              <button
                onClick={() => setShowStockInModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>{language === 'bn' ? 'স্টক ইন (ক্রয়)' : 'Stock In'}</span>
              </button>
              <button
                onClick={() => setShowStockOutModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition"
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>{language === 'bn' ? 'স্টক আউট (বিতরণ)' : 'Stock Out'}</span>
              </button>
            </>
          )}

          {activeSubTab === 'house_system' && (
            <button
              onClick={() => setShowHousePointModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition"
            >
              <Award className="w-4 h-4" />
              <span>{language === 'bn' ? 'পয়েন্ট যোগ/বিয়োগ' : 'Award / Deduct Points'}</span>
            </button>
          )}

          {activeSubTab === 'fuzala_alumni' && (
            <button
              onClick={() => setShowAddAlumniModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'bn' ? 'নতুন অ্যালামনাই নিবন্ধন' : 'Register Alumni'}</span>
            </button>
          )}

          {activeSubTab === 'health_medical' && (
            <button
              onClick={() => setShowAddHealthModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'bn' ? 'চিকিৎসা লগ যুক্ত করুন' : 'New Health Incident'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. FIXED ASSETS SUBTAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'fixed_assets' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-mono text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                      {asset.assetCode}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                        asset.condition === 'operational'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : asset.condition === 'maintenance'
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {asset.condition === 'operational'
                        ? language === 'bn' ? 'সচল' : 'Active'
                        : asset.condition === 'maintenance'
                        ? language === 'bn' ? 'মেরামত চলছে' : 'In Service'
                        : language === 'bn' ? 'বাতিল' : 'Disposed'}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mt-3 leading-snug">
                    {language === 'bn' ? asset.name : asset.nameEn}
                  </h3>

                  <div className="space-y-1.5 mt-3 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="font-medium text-slate-700 dark:text-slate-200">{asset.location}</span>
                    </div>
                    {asset.assignedTo && (
                      <div className="flex items-center space-x-2">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300">{asset.assignedTo}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>{language === 'bn' ? 'ক্রয় তারিখ:' : 'Purchased:'} {asset.purchaseDate}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block">{language === 'bn' ? 'ক্রয়মূল্য' : 'Cost'}</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-100">৳{formatNumber(asset.cost, language)}</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setSelectedAssetForPrint(asset)}
                      title={language === 'bn' ? 'সম্পদ স্লিপ ও QR কোড' : 'Asset Slip & QR'}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs transition"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDelete({ kind: 'asset', id: asset.id, message: language === 'bn' ? 'আপনি কি নিশ্চিত এই সম্পদটি ডিলিট করতে চান?' : 'Delete this asset?' })}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAssets.length === 0 && (
            <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                {language === 'bn' ? 'কোনো স্থায়ী সম্পদ খুঁজে পাওয়া যায়নি।' : 'No fixed assets match criteria.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. STORE INVENTORY & CONSUMABLES SUBTAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'store_inventory' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{language === 'bn' ? 'চলতি স্টোর ইনভেন্টরি স্টক তালিকা' : 'Store Stock & Consumption Inventory'}</span>
              </h2>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {filteredStoreItems.length} {language === 'bn' ? 'টি আইটেম' : 'Items'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50/75 dark:bg-slate-800/50/75 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-2xs uppercase">
                  <tr>
                    <th className="p-3.5">{language === 'bn' ? 'আইটেম কোড' : 'Code'}</th>
                    <th className="p-3.5">{language === 'bn' ? 'পণ্যের নাম ও বিবরণ' : 'Item Details'}</th>
                    <th className="p-3.5">{language === 'bn' ? 'ক্যাটাগরি' : 'Category'}</th>
                    <th className="p-3.5">{language === 'bn' ? 'মজুদ পরিমাণ' : 'Stock Quantity'}</th>
                    <th className="p-3.5">{language === 'bn' ? 'সতর্কতা লেভেল' : 'Min Alert'}</th>
                    <th className="p-3.5">{language === 'bn' ? 'আনুমানিক একক মূল্য' : 'Unit Price'}</th>
                    <th className="p-3.5">{language === 'bn' ? 'সর্বশেষ রিস্টক' : 'Restocked'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStoreItems.map(item => {
                    const isLow = item.currentStock <= item.minThreshold;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50/70 transition">
                        <td className="p-3.5 font-mono font-bold text-indigo-700 dark:text-indigo-400">{item.itemCode}</td>
                        <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-100">
                          <div>{language === 'bn' ? item.name : item.nameEn}</div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-2xs font-semibold">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <span className={`text-base font-black ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'}`}>
                              {formatNumber(item.currentStock, language)} {item.unit}
                            </span>
                            {isLow && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-2xs font-bold">
                                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>{language === 'bn' ? 'লো স্টক' : 'Low'}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 font-medium">
                          {formatNumber(item.minThreshold, language)} {item.unit}
                        </td>
                        <td className="p-3.5 font-bold text-slate-700 dark:text-slate-200">৳{formatNumber(item.unitPrice, language)}</td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 text-xs">{item.lastRestockedDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock In & Out Activity Logs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{language === 'bn' ? 'স্টক ইন ও বিতরণের সাম্প্রতিক লগ' : 'Recent Stock In/Out Log'}</span>
              </span>
              <span className="text-2xs text-slate-400 dark:text-slate-500">{movements.length} {language === 'bn' ? 'টি এন্ট্রি' : 'Entries'}</span>
            </h2>

            <div className="space-y-2.5">
              {movements.map(mov => (
                <div
                  key={mov.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-xl ${
                        mov.type === 'in' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400'
                      }`}
                    >
                      {mov.type === 'in' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {mov.itemName} •{' '}
                        <span className={mov.type === 'in' ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : 'text-indigo-700 dark:text-indigo-400 font-extrabold'}>
                          {mov.type === 'in' ? '+' : '-'}{formatNumber(mov.quantity, language)}
                        </span>
                      </div>
                      <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {mov.type === 'in' ? (language === 'bn' ? 'সরবরাহকারী:' : 'Vendor:') : (language === 'bn' ? 'গ্রহীতা:' : 'Recipient:')}{' '}
                        {mov.recipientOrVendor} | {language === 'bn' ? 'অনুমোদন:' : 'Approved:'} {mov.approvedBy}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block">{mov.date}</span>
                    {mov.notes && <span className="text-2xs text-slate-500 dark:text-slate-400 italic block mt-0.5">{mov.notes}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. HOUSE SYSTEM & HOSTEL WINGS SUBTAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'house_system' && (
        <div className="space-y-6">
          {/* House Leaderboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {houses.map(house => (
              <div
                key={house.id}
                className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border-2 shadow-sm relative overflow-hidden transition-all hover:shadow-lg ${house.borderColor}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-sm shadow-md"
                    style={{ backgroundColor: house.colorHex }}
                  >
                    #{house.rank}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-2xs font-black uppercase tracking-wider ${house.badgeBg}`}>
                    {house.code}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className={`font-black text-lg ${house.textColor}`}>{house.nameBn}</h3>
                  <p className="text-2xs text-slate-400 dark:text-slate-500 font-medium italic mt-0.5">"{house.motto}"</p>
                </div>

                <div className="mt-4 py-3 border-y border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block">{language === 'bn' ? 'মোট হাউজ পয়েন্ট' : 'House Points'}</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatNumber(house.points, language)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block">{language === 'bn' ? 'ছাত্র সদস্য' : 'Members'}</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatNumber(house.memberCount, language)} জন</span>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-2xs text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">{language === 'bn' ? 'হাউজ মাস্টার:' : 'Master:'}</span>{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{house.houseMaster}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">{language === 'bn' ? 'হাউজ ক্যাপ্টেন:' : 'Prefect:'}</span>{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{house.prefect}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Points History Log */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{language === 'bn' ? 'হাউজ পয়েন্ট প্রদানের সাম্প্রতিক বিবরণী' : 'House Points Award & Deduction Log'}</span>
              </span>
              <span className="text-2xs text-slate-400 dark:text-slate-500">{housePointLogs.length} {language === 'bn' ? 'টি ইভেন্ট' : 'Events'}</span>
            </h2>

            <div className="space-y-3">
              {housePointLogs.map(log => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        log.change >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      {log.change >= 0 ? `+${log.change}` : log.change}
                    </span>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {log.houseName} •{' '}
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{log.reason}</span>
                      </div>
                      <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {language === 'bn' ? 'ক্যাটাগরি:' : 'Category:'} {log.category} |{' '}
                        {language === 'bn' ? 'প্রদানকারী:' : 'Awarded by:'} {log.awardedBy}
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:shrink-0">
                    <span className="text-2xs font-semibold text-slate-400 dark:text-slate-500">{log.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ALUMNI & FUZALA COUNCIL SUBTAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'fuzala_alumni' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAlumni.map(member => (
              <div
                key={member.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-mono text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                      {member.regId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-2xs font-bold uppercase ${
                        member.membershipType === 'lifetime'
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : member.membershipType === 'patron'
                          ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {member.membershipType}
                    </span>
                  </div>

                  <h3 className="font-black text-slate-900 dark:text-white text-base mt-3 leading-snug">{member.name}</h3>

                  <div className="space-y-1.5 mt-3 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-100">{member.batchOrSanad} ({member.graduationYear})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>{member.currentDesignation}, {member.institutionOrOrg}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="font-mono">{member.mobile}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>{member.district} | {language === 'bn' ? 'রক্ত:' : 'Blood:'} <strong className="text-rose-600 dark:text-rose-400">{member.bloodGroup}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block">{language === 'bn' ? 'অ্যালামনাই অনুদান' : 'Contribution'}</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400">৳{formatNumber(member.totalDonation, language)}</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setSelectedAlumniForPrint(member)}
                      title={language === 'bn' ? 'অ্যালামনাই সনদ ও আইডি স্লিপ' : 'Alumni ID & Certificate'}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-xs font-semibold transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'আইডি কার্ড' : 'Card'}</span>
                    </button>
                    <button
                      onClick={() => setPendingDelete({ kind: 'alumni', id: member.id, message: language === 'bn' ? 'এই রেকর্ডটি ডিলিট করতে চান?' : 'Delete member?' })}
                      className="p-1.5 rounded-xl text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAlumni.length === 0 && (
            <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                {language === 'bn' ? 'কোনো প্রাক্তন শিক্ষার্থী সদস্য খুঁজে পাওয়া যায়নি।' : 'No alumni records found.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HEALTH CARE & FIRST AID LOG SUBTAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'health_medical' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHealth.map(incident => (
              <div
                key={incident.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition ${
                  incident.resolved ? 'border-slate-200 dark:border-slate-800' : 'border-rose-300 dark:border-rose-700 bg-rose-50/20 dark:bg-rose-950/50/20'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-2xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {incident.date}
                    </span>
                    <button
                      onClick={() => toggleHealthResolved(incident.id)}
                      className={`px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase transition ${
                        incident.resolved
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                          : 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 hover:bg-rose-200'
                      }`}
                    >
                      {incident.resolved
                        ? (language === 'bn' ? 'সুস্থ / সম্পন্ন' : 'Resolved')
                        : (language === 'bn' ? 'চিকিৎসাধীন' : 'Under Care')}
                    </button>
                  </div>

                  <h3 className="font-black text-slate-900 dark:text-white text-base mt-2.5">
                    {incident.studentName} •{' '}
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {incident.className} (রোল {incident.studentRoll})
                    </span>
                  </h3>

                  <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <div>
                      <span className="text-2xs text-slate-400 dark:text-slate-500 block font-bold uppercase">{language === 'bn' ? 'উপসর্গ / অভিযোগ:' : 'Complaint:'}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{incident.symptoms}</span>
                      {incident.temperature && (
                        <span className="ml-2 px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-2xs font-bold rounded">
                          {incident.temperature}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-2xs text-slate-400 dark:text-slate-500 block font-bold uppercase">{language === 'bn' ? 'প্রদত্ত প্রাথমিক ঔষধ:' : 'Medicine Given:'}</span>
                      <span className="text-slate-700 dark:text-slate-200">{incident.medicationGiven}</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-2xs text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">{language === 'bn' ? 'গৃহীত ব্যবস্থা:' : 'Action Taken:'}</span>{' '}
                      <span className="font-semibold text-indigo-700 dark:text-indigo-400">{incident.actionTaken}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">{language === 'bn' ? 'দায়িত্বপ্রাপ্ত স্টাফ:' : 'Attending Staff:'}</span>{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{incident.attendingStaff}</span>
                    </div>
                    {incident.guardianPhone && (
                      <div className="flex items-center space-x-1.5 mt-1">
                        <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <span className="font-mono text-slate-700 dark:text-slate-200">{incident.guardianPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-2xs font-bold text-slate-500 dark:text-slate-400">
                    {language === 'bn' ? 'রক্তের গ্রুপ:' : 'Blood:'} <strong className="text-rose-600 dark:text-rose-400 text-xs">{incident.bloodGroup}</strong>
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setSelectedHealthForPrint(incident)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                      title={language === 'bn' ? 'প্রেসক্রিপশন প্রিন্ট' : 'Print Slip'}
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDelete({ kind: 'health', id: incident.id, message: language === 'bn' ? 'লগটি অপসারণ করতে চান?' : 'Delete log?' })}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredHealth.length === 0 && (
            <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800">
              <HeartPulse className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                {language === 'bn' ? 'কোনো চিকিৎসা রেকর্ড পাওয়া যায়নি।' : 'No health incidents match criteria.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD FIXED ASSET */}
      {/* ========================================================================= */}
      {showAddAssetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{language === 'bn' ? 'নতুন স্থায়ী সম্পদ রেজিস্টার' : 'Add New Fixed Asset'}</span>
              </h3>
              <button
                onClick={() => setShowAddAssetModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="space-y-3.5 text-xs md:text-sm">
              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {language === 'bn' ? 'সম্পদের নাম (বাংলা) *' : 'Asset Title (Bengali) *'}
                </label>
                <input
                  type="text"
                  required
                  value={newAsset.name || ''}
                  onChange={e => setNewAsset({ ...newAsset, name: e.target.value })}
                  placeholder="যেমন: মিলনায়তন সাউন্ড সিস্টেম বা অফিস কম্পিউটার"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                    {language === 'bn' ? 'সম্পদ কোড (ঐচ্ছিক)' : 'Asset Tag / Code'}
                  </label>
                  <input
                    type="text"
                    value={newAsset.assetCode || ''}
                    onChange={e => setNewAsset({ ...newAsset, assetCode: e.target.value })}
                    placeholder="AST-2026-006"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'ক্যাটাগরি' : 'Category'}</label>
                  <select
                    value={newAsset.category}
                    onChange={e => setNewAsset({ ...newAsset, category: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  >
                    <option value="furniture">{language === 'bn' ? 'আসবাবপত্র' : 'Furniture'}</option>
                    <option value="sound_system">{language === 'bn' ? 'সাউন্ড সিস্টেম' : 'Sound System'}</option>
                    <option value="electronics">{language === 'bn' ? 'ইলেকট্রনিক্স ও আইটি' : 'Electronics'}</option>
                    <option value="campus_facility">{language === 'bn' ? 'ক্যাম্পাস সরঞ্জাম' : 'Campus Facility'}</option>
                    <option value="lab_kitab">{language === 'bn' ? 'কুতুবখানা র‍্যাক' : 'Library & Lab'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {language === 'bn' ? 'বরাদ্দকৃত কক্ষ বা অবস্থান *' : 'Assigned Location / Room *'}
                </label>
                <input
                  type="text"
                  required
                  value={newAsset.location || ''}
                  onChange={e => setNewAsset({ ...newAsset, location: e.target.value })}
                  placeholder="যেমন: প্রধান কুতুবখানা, রুম নং ২০৪"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'ক্রয়মূল্য (৳)' : 'Cost (৳)'}</label>
                  <input
                    type="number"
                    value={newAsset.cost || ''}
                    onChange={e => setNewAsset({ ...newAsset, cost: Number(e.target.value) })}
                    placeholder="25000"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'ক্রয় তারিখ' : 'Purchase Date'}</label>
                  <input
                    type="date"
                    value={newAsset.purchaseDate || ''}
                    onChange={e => setNewAsset({ ...newAsset, purchaseDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'দায়িত্বপ্রাপ্ত শিক্ষক/ব্যক্তি' : 'Assigned Person'}</label>
                <input
                  type="text"
                  value={newAsset.assignedTo || ''}
                  onChange={e => setNewAsset({ ...newAsset, assignedTo: e.target.value })}
                  placeholder="যেমন: মাওলানা মাহমুদ হাসান"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAssetModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {language === 'bn' ? 'সম্পদ সংরক্ষণ করুন' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: STOCK IN / STOCK OUT */}
      {/* ========================================================================= */}
      {(showStockInModal || showStockOutModal) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                {showStockInModal ? (
                  <>
                    <ArrowDownCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>{language === 'bn' ? 'স্টক ইন (নতুন মালামাল গ্রহণ)' : 'Stock In / Restock'}</span>
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>{language === 'bn' ? 'স্টক আউট (মালামাল বিতরণ)' : 'Stock Out / Distribute'}</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  setShowStockInModal(false);
                  setShowStockOutModal(false);
                }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={showStockInModal ? handleStockIn : handleStockOut} className="space-y-3.5 text-xs md:text-sm">
              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'পণ্য নির্বাচন করুন' : 'Select Item'}</label>
                <select
                  value={stockEntry.itemId}
                  onChange={e => setStockEntry({ ...stockEntry, itemId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-semibold"
                >
                  {storeItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (মজুদ: {item.currentStock} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'পরিমাণ' : 'Quantity'}</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockEntry.quantity}
                  onChange={e => setStockEntry({ ...stockEntry, quantity: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {showStockInModal
                    ? (language === 'bn' ? 'সরবরাহকারী / দোকান' : 'Vendor / Source')
                    : (language === 'bn' ? 'প্রাপক শিক্ষক / জামাত' : 'Recipient Staff / Class')}
                </label>
                <input
                  type="text"
                  required
                  value={stockEntry.recipientOrVendor}
                  onChange={e => setStockEntry({ ...stockEntry, recipientOrVendor: e.target.value })}
                  placeholder={showStockInModal ? 'যেমন: মদিনা পেপার হাউস' : 'যেমন: হিফজখানা উস্তাদবৃন্দ'}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'অনুমোদনকারী' : 'Approved By'}</label>
                <input
                  type="text"
                  value={stockEntry.approvedBy}
                  onChange={e => setStockEntry({ ...stockEntry, approvedBy: e.target.value })}
                  placeholder="যেমন: নাযেম-ই তালিমাত"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'মন্তব্য' : 'Notes'}</label>
                <input
                  type="text"
                  value={stockEntry.notes}
                  onChange={e => setStockEntry({ ...stockEntry, notes: e.target.value })}
                  placeholder="ঐচ্ছিক মন্তব্য"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowStockInModal(false);
                    setShowStockOutModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-white font-bold ${
                    showStockInModal ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {language === 'bn' ? 'নিশ্চিত করুন' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: HOUSE POINTS AWARD */}
      {/* ========================================================================= */}
      {showHousePointModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{language === 'bn' ? 'হাউজ পয়েন্ট প্রদান বা কর্তন' : 'Award / Deduct House Points'}</span>
              </h3>
              <button onClick={() => setShowHousePointModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold">
                ×
              </button>
            </div>

            <form onSubmit={handleAwardHousePoints} className="space-y-3.5 text-xs md:text-sm">
              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'হাউজ নির্বাচন করুন' : 'Select House'}</label>
                <select
                  value={housePointForm.houseId}
                  onChange={e => setHousePointForm({ ...housePointForm, houseId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-bold"
                >
                  {houses.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.nameBn} (বর্তমান পয়েন্ট: {h.points})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'পয়েন্ট পরিবর্তন (+/-)' : 'Points Change'}</label>
                  <input
                    type="number"
                    required
                    value={housePointForm.change}
                    onChange={e => setHousePointForm({ ...housePointForm, change: Number(e.target.value) })}
                    placeholder="+20 বা -10"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-base font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'বিভাগ / ক্যাটাগরি' : 'Category'}</label>
                  <select
                    value={housePointForm.category}
                    onChange={e => setHousePointForm({ ...housePointForm, category: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  >
                    <option value="discipline">{language === 'bn' ? 'শৃঙ্খলা ও আমল' : 'Discipline'}</option>
                    <option value="cleanliness">{language === 'bn' ? 'পরিচ্ছন্নতা (নাযাফত)' : 'Cleanliness'}</option>
                    <option value="quran_hifz">{language === 'bn' ? 'কেরাত ও হেফজ' : 'Quran / Hifz'}</option>
                    <option value="debate_culture">{language === 'bn' ? 'বক্তৃতা ও সাহিত্য' : 'Speech / Debate'}</option>
                    <option value="sports">{language === 'bn' ? 'ক্রীড়া ও শারীরিক' : 'Sports'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'কারণ বা ইভেন্টের বিবরণ *' : 'Event / Reason *'}</label>
                <input
                  type="text"
                  required
                  value={housePointForm.reason}
                  onChange={e => setHousePointForm({ ...housePointForm, reason: e.target.value })}
                  placeholder="যেমন: সাপ্তাহিক ডরমিটরি পরিচ্ছন্নতায় ১ম স্থান"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'বিচারক / প্রদানকারী' : 'Awarded By'}</label>
                <input
                  type="text"
                  value={housePointForm.awardedBy}
                  onChange={e => setHousePointForm({ ...housePointForm, awardedBy: e.target.value })}
                  placeholder="যেমন: অধ্যক্ষ মহোদয় বা বিচারক মণ্ডলী"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHousePointModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  {language === 'bn' ? 'পয়েন্ট যুক্ত করুন' : 'Award Points'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD ALUMNI */}
      {/* ========================================================================= */}
      {showAddAlumniModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{language === 'bn' ? 'নতুন প্রাক্তন শিক্ষার্থী (অ্যালামনাই) নিবন্ধন' : 'Register Alumni Member'}</span>
              </h3>
              <button onClick={() => setShowAddAlumniModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold">
                ×
              </button>
            </div>

            <form onSubmit={handleAddAlumni} className="space-y-3.5 text-xs md:text-sm">
              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'সদস্যের নাম *' : 'Full Name *'}</label>
                <input
                  type="text"
                  required
                  value={newAlumni.name || ''}
                  onChange={e => setNewAlumni({ ...newAlumni, name: e.target.value })}
                  placeholder="যেমন: মাওলানা হাফেজ আব্দুল্লাহ আল মামুন"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'পাসের সাল / ব্যাচ' : 'Graduation Year'}</label>
                  <input
                    type="text"
                    value={newAlumni.graduationYear || ''}
                    onChange={e => setNewAlumni({ ...newAlumni, graduationYear: e.target.value })}
                    placeholder="২০২৪"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'সনদ / শ্রেণি' : 'Degree / Class'}</label>
                  <input
                    type="text"
                    value={newAlumni.batchOrSanad || ''}
                    onChange={e => setNewAlumni({ ...newAlumni, batchOrSanad: e.target.value })}
                    placeholder="দাখিল / আলিম / ফাজিল / কামিল"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'বর্তমান পেশা / কর্মক্ষেত্র' : 'Current Occupation'}</label>
                  <input
                    type="text"
                    value={newAlumni.currentDesignation || ''}
                    onChange={e => setNewAlumni({ ...newAlumni, currentDesignation: e.target.value })}
                    placeholder="ইমাম ও খতিব / শিক্ষক"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Current Organization'}</label>
                  <input
                    type="text"
                    value={newAlumni.institutionOrOrg || ''}
                    onChange={e => setNewAlumni({ ...newAlumni, institutionOrOrg: e.target.value })}
                    placeholder="বায়তুস সালাম জামে মসজিদ"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'মোবাইল নম্বর *' : 'Mobile Number *'}</label>
                  <input
                    type="text"
                    required
                    value={newAlumni.mobile || ''}
                    onChange={e => setNewAlumni({ ...newAlumni, mobile: e.target.value })}
                    placeholder="01711-XXXXXX"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'জেলা' : 'District'}</label>
                  <input
                    type="text"
                    value={newAlumni.district || ''}
                    onChange={e => setNewAlumni({ ...newAlumni, district: e.target.value })}
                    placeholder="ঢাকা / চট্টগ্রাম / সিলেট"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'সদস্যপদ টাইপ' : 'Membership'}</label>
                  <select
                    value={newAlumni.membershipType}
                    onChange={e => setNewAlumni({ ...newAlumni, membershipType: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold"
                  >
                    <option value="general">{language === 'bn' ? 'সাধারণ সদস্য' : 'General'}</option>
                    <option value="lifetime">{language === 'bn' ? 'আজীবন সদস্য' : 'Lifetime'}</option>
                    <option value="patron">{language === 'bn' ? 'পৃষ্ঠপোষক' : 'Patron'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}</label>
                  <select
                    value={newAlumni.bloodGroup}
                    onChange={e => setNewAlumni({ ...newAlumni, bloodGroup: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAlumniModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  {language === 'bn' ? 'নিবন্ধন সম্পন্ন করুন' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ADD HEALTH RECORD */}
      {/* ========================================================================= */}
      {showAddHealthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <span>{language === 'bn' ? 'চিকিৎসা সেবা ও ফার্স্ট এইড লগ' : 'New Health Incident'}</span>
              </h3>
              <button onClick={() => setShowAddHealthModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold">
                ×
              </button>
            </div>

            <form onSubmit={handleAddHealth} className="space-y-3.5 text-xs md:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'শিক্ষার্থীর নাম *' : 'Student Name *'}</label>
                  <input
                    type="text"
                    required
                    value={newHealthRecord.studentName || ''}
                    onChange={e => setNewHealthRecord({ ...newHealthRecord, studentName: e.target.value })}
                    placeholder="মুহাম্মদ তানভীর"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'রোল নং' : 'Roll'}</label>
                  <input
                    type="text"
                    value={newHealthRecord.studentRoll || ''}
                    onChange={e => setNewHealthRecord({ ...newHealthRecord, studentRoll: e.target.value })}
                    placeholder="১০৫"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'শ্রেণি / জামাত' : 'Class / Jamat'}</label>
                  <input
                    type="text"
                    value={newHealthRecord.className || ''}
                    onChange={e => setNewHealthRecord({ ...newHealthRecord, className: e.target.value })}
                    placeholder="হেফজখানা / কাফিয়া"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'রক্তের গ্রুপ' : 'Blood'}</label>
                  <select
                    value={newHealthRecord.bloodGroup}
                    onChange={e => setNewHealthRecord({ ...newHealthRecord, bloodGroup: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'উপসর্গ / অভিযোগ *' : 'Symptoms / Illness *'}</label>
                <textarea
                  required
                  rows={2}
                  value={newHealthRecord.symptoms || ''}
                  onChange={e => setNewHealthRecord({ ...newHealthRecord, symptoms: e.target.value })}
                  placeholder="যেমন: জ্বর (১০১°F), তীব্র পেটব্যথা ও বমি ভাব"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'প্রদত্ত প্রাথমিক ঔষধ / সেবা' : 'Medication / Treatment'}</label>
                <input
                  type="text"
                  value={newHealthRecord.medicationGiven || ''}
                  onChange={e => setNewHealthRecord({ ...newHealthRecord, medicationGiven: e.target.value })}
                  placeholder="যেমন: প্যারাসিটামল ৫০০ মি.গ্রা. + ওআরএস স্যালাইন"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'গৃহীত ব্যবস্থা' : 'Action Taken'}</label>
                  <select
                    value={newHealthRecord.actionTaken}
                    onChange={e => setNewHealthRecord({ ...newHealthRecord, actionTaken: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold"
                  >
                    <option value="hostel_rest">{language === 'bn' ? 'হোস্টেলে বিশ্রাম' : 'Hostel Rest'}</option>
                    <option value="returned_class">{language === 'bn' ? 'ক্লাসে ফেরত' : 'Back to Class'}</option>
                    <option value="referred_hospital">{language === 'bn' ? 'হাসপাতালে রেফার্ড' : 'Referred Clinic'}</option>
                    <option value="guardian_informed">{language === 'bn' ? 'অভিভাবককে জানানো হয়েছে' : 'Guardian Contacted'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">{language === 'bn' ? 'অভিভাবকের ফোন' : 'Guardian Phone'}</label>
                  <input
                    type="text"
                    value={newHealthRecord.guardianPhone || ''}
                    onChange={e => setNewHealthRecord({ ...newHealthRecord, guardianPhone: e.target.value })}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddHealthModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold">
                  {language === 'bn' ? 'লগ সংরক্ষণ করুন' : 'Save Health Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT PREVIEW MODAL (ASSET / ALUMNI / HEALTH) */}
      {/* ========================================================================= */}
      {(selectedAssetForPrint || selectedAlumniForPrint || selectedHealthForPrint) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <span>{language === 'bn' ? 'অফিসিয়াল ডকুমেন্টস প্রিভিউ' : 'Official Print Slip'}</span>
              </h3>
              <button
                onClick={() => {
                  setSelectedAssetForPrint(null);
                  setSelectedAlumniForPrint(null);
                  setSelectedHealthForPrint(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-5 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 space-y-3 text-center">
              <div className="text-sm font-black text-slate-900">{schoolProfile.nameBn || schoolProfile.name}</div>
              <div className="text-2xs text-slate-500">{schoolProfile.address || 'বাংলাদেশ'}</div>

              {selectedAssetForPrint && (
                <div className="pt-3 border-t border-slate-200 space-y-2 text-left text-xs">
                  <div className="text-center font-mono font-bold text-indigo-700 text-sm bg-white p-2 rounded-lg border border-slate-200">
                    {selectedAssetForPrint.assetCode}
                  </div>
                  <div><strong>{language === 'bn' ? 'সম্পদ:' : 'Asset:'}</strong> {selectedAssetForPrint.name}</div>
                  <div><strong>{language === 'bn' ? 'অবস্থান:' : 'Location:'}</strong> {selectedAssetForPrint.location}</div>
                  <div><strong>{language === 'bn' ? 'মূল্য:' : 'Cost:'}</strong> ৳{formatNumber(selectedAssetForPrint.cost, language)}</div>
                  <div><strong>{language === 'bn' ? 'তারিখ:' : 'Date:'}</strong> {selectedAssetForPrint.purchaseDate}</div>
                </div>
              )}

              {selectedAlumniForPrint && (
                <div className="pt-3 border-t border-slate-200 space-y-2 text-left text-xs">
                  <div className="text-center font-mono font-bold text-indigo-700 text-sm bg-white p-2 rounded-lg border border-slate-200">
                    {selectedAlumniForPrint.regId}
                  </div>
                  <div><strong>{language === 'bn' ? 'নাম:' : 'Name:'}</strong> {selectedAlumniForPrint.name}</div>
                  <div><strong>{language === 'bn' ? 'ব্যাচ / বিভাগ:' : 'Batch:'}</strong> {selectedAlumniForPrint.batchOrSanad} ({selectedAlumniForPrint.graduationYear})</div>
                  <div><strong>{language === 'bn' ? 'বর্তমান খেদমত:' : 'Profession:'}</strong> {selectedAlumniForPrint.currentDesignation}</div>
                  <div><strong>{language === 'bn' ? 'মোবাইল:' : 'Phone:'}</strong> {selectedAlumniForPrint.mobile}</div>
                </div>
              )}

              {selectedHealthForPrint && (
                <div className="pt-3 border-t border-slate-200 space-y-2 text-left text-xs">
                  <div className="text-center font-bold text-rose-700 text-sm bg-rose-50 p-2 rounded-lg border border-rose-200">
                    {language === 'bn' ? 'জরুরি চিকিৎসা স্লিপ' : 'Emergency Medical Slip'}
                  </div>
                  <div><strong>{language === 'bn' ? 'শিক্ষার্থী:' : 'Student:'}</strong> {selectedHealthForPrint.studentName} (রোল {selectedHealthForPrint.studentRoll})</div>
                  <div><strong>{language === 'bn' ? 'শ্রেণি:' : 'Class:'}</strong> {selectedHealthForPrint.className}</div>
                  <div><strong>{language === 'bn' ? 'উপসর্গ:' : 'Symptoms:'}</strong> {selectedHealthForPrint.symptoms}</div>
                  <div><strong>{language === 'bn' ? 'প্রদত্ত ঔষধ:' : 'Rx:'}</strong> {selectedHealthForPrint.medicationGiven}</div>
                  <div><strong>{language === 'bn' ? 'তারিখ:' : 'Date:'}</strong> {selectedHealthForPrint.date}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => {
                  setSelectedAssetForPrint(null);
                  setSelectedAlumniForPrint(null);
                  setSelectedHealthForPrint(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs"
              >
                {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
              <button
                onClick={handlePrint}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'প্রিন্ট দিন' : 'Print Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
        title={language === 'bn' ? 'ডিলিট নিশ্চিতকরণ' : 'Confirm Deletion'}
        message={pendingDelete?.message || ''}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />
    </div>
  );
};
