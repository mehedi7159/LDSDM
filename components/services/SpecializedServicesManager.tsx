import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BookOpen,
  Library,
  Bus,
  CalendarDays,
  Trophy,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Users,
  Printer,
  ChevronRight,
  Sparkles,
  Phone,
  MapPin,
  DollarSign,
  FileText,
  Calendar,
  X,
  RefreshCw,
  Heart,
  Award,
  Check
} from 'lucide-react';
import { formatSafeDate, toBengali, formatNumber } from '../../services/utils';

// ================= TYPES =================
export interface BookItem {
  id: string;
  accessionNo: string;
  title: string;
  titleBn: string;
  author: string;
  publisher?: string;
  category: 'tafsir' | 'hadith' | 'fiqh' | 'arabic' | 'quran' | 'general' | 'academic';
  almirah: string;
  shelf: string;
  totalCopies: number;
  availableCopies: number;
  price?: number;
  condition: 'new' | 'good' | 'fair' | 'damaged';
  entryDate: string;
}

export interface BookIssueRecord {
  id: string;
  bookId: string;
  bookTitle: string;
  accessionNo: string;
  borrowerType: 'student' | 'teacher';
  borrowerId: string;
  borrowerName: string;
  borrowerRoll?: number;
  borrowerClass?: string;
  borrowerPhone?: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'issued' | 'returned' | 'overdue' | 'lost';
  fineAmount?: number;
  finePaid?: boolean;
  notes?: string;
}

export interface TransportVehicle {
  id: string;
  vehicleNo: string;
  vehicleType: 'bus' | 'minibus' | 'microbus' | 'van';
  driverName: string;
  driverPhone: string;
  helperName?: string;
  helperPhone?: string;
  capacity: number;
  routeName: string;
  stoppages: string[];
  departureTime: string;
  returnTime: string;
  monthlyFee: number;
  status: 'active' | 'maintenance' | 'inactive';
}

export interface StudentTransportRoster {
  id: string;
  studentId: string;
  studentName: string;
  studentRoll: number;
  studentClass: string;
  vehicleId: string;
  stoppage: string;
  pickupTime: string;
  guardianPhone: string;
  feeStatus: 'paid' | 'due';
}

export interface MahfilEvent {
  id: string;
  title: string;
  titleBn: string;
  category: 'mahfil' | 'dastarbandi' | 'seerat' | 'sports' | 'competition';
  eventDate: string;
  venue: string;
  chairperson: string;
  chiefGuest: string;
  speakers: { name: string; topic: string; time: string; phone?: string; honorarium?: number }[];
  budget: number;
  totalCollection: number;
  totalExpense: number;
  volunteers: { name: string; duty: string; phone: string }[];
  status: 'planned' | 'ongoing' | 'completed';
}

export interface CoCurricularClub {
  id: string;
  name: string;
  nameBn: string;
  category: 'quran_qiraat' | 'debate' | 'literature' | 'science' | 'scout';
  convener: string;
  convenerPhone: string;
  membersCount: number;
  meetingDay: string;
  activitiesCount: number;
  description: string;
}

interface SpecializedServicesManagerProps {
  initialSubTab?: 'book_bank' | 'book_issues' | 'transport_fleet' | 'mahfil_events' | 'activities_clubs';
  onNavigateTab?: (tab: string) => void;
}

export const SpecializedServicesManager: React.FC<SpecializedServicesManagerProps> = ({
  initialSubTab = 'book_bank',
  onNavigateTab
}) => {
  const { language, schoolProfile, students, classes } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<
    'book_bank' | 'book_issues' | 'transport_fleet' | 'mahfil_events' | 'activities_clubs'
  >(initialSubTab);

  // Sync prop changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // ================= STORAGE INITIALIZERS =================
  const [books, setBooks] = useState<BookItem[]>(() => {
    const saved = localStorage.getItem('madrasah_books_catalog');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'book-1',
        accessionNo: 'ACC-1001',
        title: 'Sahih al-Bukhari (Vol 1)',
        titleBn: 'সহীহুল বুখারী (১ম খণ্ড)',
        author: 'ইমাম বুখারী (রহ.)',
        publisher: 'দারুস সালাম',
        category: 'hadith',
        almirah: 'আলমিরা-০১',
        shelf: 'র্যাক-৩',
        totalCopies: 6,
        availableCopies: 4,
        price: 850,
        condition: 'good',
        entryDate: '2025-01-15'
      },
      {
        id: 'book-2',
        accessionNo: 'ACC-1002',
        title: 'Al-Hidayah (Vol 1 & 2)',
        titleBn: 'আল-হিদায়া (১ম ও ২য় খণ্ড)',
        author: 'ইমাম আল-মারগীনানী (রহ.)',
        publisher: 'মাকতাবাতুল বুশরা',
        category: 'fiqh',
        almirah: 'আলমিরা-০২',
        shelf: 'র্যাক-১',
        totalCopies: 5,
        availableCopies: 3,
        price: 950,
        condition: 'new',
        entryDate: '2025-02-10'
      },
      {
        id: 'book-3',
        accessionNo: 'ACC-1003',
        title: 'Tafsir Maariful Quran (Complete Set)',
        titleBn: 'তাফসীরে মাআরিফুল কুরআন (৮ খণ্ড)',
        author: 'মুফতী শফী (রহ.)',
        publisher: 'ইসলামিক ফাউন্ডেশন',
        category: 'tafsir',
        almirah: 'আলমিরা-০৩',
        shelf: 'র্যাক-২',
        totalCopies: 8,
        availableCopies: 7,
        price: 3200,
        condition: 'good',
        entryDate: '2025-01-20'
      },
      {
        id: 'book-4',
        accessionNo: 'ACC-1004',
        title: 'Riyadus Salihin',
        titleBn: 'রিয়াযুস সালিহীন',
        author: 'ইমাম আন-নববী (রহ.)',
        publisher: 'মাকতাবাতুত তাওহীদ',
        category: 'hadith',
        almirah: 'আলমিরা-০২',
        shelf: 'র্যাক-৪',
        totalCopies: 7,
        availableCopies: 6,
        price: 600,
        condition: 'good',
        entryDate: '2025-02-01'
      },
      {
        id: 'book-5',
        accessionNo: 'ACC-1005',
        title: 'Noorani Qaida & Para Amma',
        titleBn: 'নূরানী কায়দা ও আমপারা সংকলন',
        author: 'মুহম্মদ শাহজাহান',
        publisher: 'নূরানী প্রকাশনী',
        category: 'quran',
        almirah: 'আলমিরা-০১',
        shelf: 'র্যাক-১',
        totalCopies: 25,
        availableCopies: 22,
        price: 80,
        condition: 'new',
        entryDate: '2025-01-05'
      },
      {
        id: 'book-6',
        accessionNo: 'ACC-1006',
        title: 'Arabic Grammar & Composition',
        titleBn: 'এসো আরবি শিখি ও তাসরীক',
        author: 'মাওলানা আবু তাহের মিসবাহ',
        publisher: 'দারুল কলম',
        category: 'arabic',
        almirah: 'আলমিরা-০৪',
        shelf: 'র্যাক-২',
        totalCopies: 12,
        availableCopies: 10,
        price: 240,
        condition: 'good',
        entryDate: '2025-02-15'
      }
    ];
  });

  const [bookIssues, setBookIssues] = useState<BookIssueRecord[]>(() => {
    const saved = localStorage.getItem('madrasah_book_issues');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'issue-1',
        bookId: 'book-1',
        bookTitle: 'সহীহুল বুখারী (১ম খণ্ড)',
        accessionNo: 'ACC-1001',
        borrowerType: 'student',
        borrowerId: 'STD-1',
        borrowerName: 'আব্দুর রহমান',
        borrowerRoll: 101,
        borrowerClass: 'দাহম (১০ম শ্রেণি)',
        borrowerPhone: '01712345678',
        issueDate: '2025-05-01',
        dueDate: '2025-05-15',
        status: 'issued',
        fineAmount: 0
      },
      {
        id: 'issue-2',
        bookId: 'book-2',
        bookTitle: 'আল-হিদায়া (১ম ও ২য় খণ্ড)',
        accessionNo: 'ACC-1002',
        borrowerType: 'student',
        borrowerId: 'STD-2',
        borrowerName: 'মোহাম্মদ আবদুল্লাহ',
        borrowerRoll: 102,
        borrowerClass: 'দাহম (১০ম শ্রেণি)',
        borrowerPhone: '01812345679',
        issueDate: '2025-04-10',
        dueDate: '2025-04-24',
        status: 'overdue',
        fineAmount: 45,
        notes: 'দেরিতে ফেরতের জন্য জরিমানা ধার্য'
      }
    ];
  });

  const [vehicles, setVehicles] = useState<TransportVehicle[]>(() => {
    const saved = localStorage.getItem('madrasah_transport_vehicles');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'veh-1',
        vehicleNo: 'ঢাকা মেট্রো-চ-১২-৩৪৫৬',
        vehicleType: 'minibus',
        driverName: 'মো. রফিকুল ইসলাম',
        driverPhone: '01711223344',
        helperName: 'মো. সুজন মিয়া',
        helperPhone: '01711223355',
        capacity: 28,
        routeName: 'রুট ০১: উত্তরা - আবদুল্লাহপুর - ক্যাম্পাস',
        stoppages: ['হাউজবিল্ডিং', 'আজমপুর', 'জসীমউদ্দীন', 'বিমানবন্দর', 'মাদরাসা মেইন গেট'],
        departureTime: '০৭:১৫ সকাল',
        returnTime: '০২:৩০ দুপুর',
        monthlyFee: 1500,
        status: 'active'
      },
      {
        id: 'veh-2',
        vehicleNo: 'ঢাকা মেট্রো-ভ-০৫-৯৮৭৬',
        vehicleType: 'microbus',
        driverName: 'কফিল উদ্দিন আহমেদ',
        driverPhone: '01822334455',
        helperName: 'মো. কাওসার',
        helperPhone: '01822334466',
        capacity: 14,
        routeName: 'রুট ০২: মিরপুর - কাজীপাড়া - ক্যাম্পাস',
        stoppages: ['মিরপুর ১০', 'কাজীপাড়া', 'শেওড়াপাড়া', 'আগারগাঁও', 'মাদরাসা মেইন গেট'],
        departureTime: '০৭:০০ সকাল',
        returnTime: '০২:৪০ দুপুর',
        monthlyFee: 1600,
        status: 'active'
      }
    ];
  });

  const [transportRoster, setTransportRoster] = useState<StudentTransportRoster[]>(() => {
    const saved = localStorage.getItem('madrasah_transport_roster');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'tr-1',
        studentId: 'STD-1',
        studentName: 'আব্দুর রহমান',
        studentRoll: 101,
        studentClass: 'দাহম',
        vehicleId: 'veh-1',
        stoppage: 'হাউজবিল্ডিং',
        pickupTime: '০৭:২০ সকাল',
        guardianPhone: '01712345678',
        feeStatus: 'paid'
      },
      {
        id: 'tr-2',
        studentId: 'STD-2',
        studentName: 'মোহাম্মদ আবদুল্লাহ',
        studentRoll: 102,
        studentClass: 'দাহম',
        vehicleId: 'veh-1',
        stoppage: 'আজমপুর',
        pickupTime: '০৭:২৫ সকাল',
        guardianPhone: '01812345679',
        feeStatus: 'due'
      }
    ];
  });

  const [events, setEvents] = useState<MahfilEvent[]>(() => {
    const saved = localStorage.getItem('madrasah_mahfil_events');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'evt-1',
        title: 'Annual Seerat-un-Nabi (PBUH) Mahfil & Prize Distribution',
        titleBn: 'বার্ষিক সীরাতুন্নবী (সা.) মাহফিল ও পুরস্কার বিতরণী সমাবেশ',
        category: 'seerat',
        eventDate: '2025-11-28',
        venue: 'মাদরাসা জামে মসজিদ ও উন্মুক্ত ময়দান',
        chairperson: 'মুহতামিম মাওলানা আব্দুল হান্নান সাহেব',
        chiefGuest: 'আল্লামা মুফতী মাহমুদুল হাসান (ঢাকা)',
        speakers: [
          { name: 'আল্লামা মুফতী মাহমুদুল হাসান', topic: 'সীরাতের আলোকে আদর্শ সমাজ বিনির্মাণ', time: 'বাদ মাগরিব', honorarium: 15000 },
          { name: 'মাওলানা কামরুল ইসলাম নোমানী', topic: 'সন্তানের ইসলামী লালন-পালন ও পিতা-মাতার কর্তব্য', time: 'বাদ আসর', honorarium: 8000 }
        ],
        budget: 180000,
        totalCollection: 215000,
        totalExpense: 145000,
        volunteers: [
          { name: 'হাফেজ বেলাল হোসেন', duty: 'তোবারক ও মেহমান আপ্যায়ন', phone: '01710001111' },
          { name: 'মাওলানা সাইফুল ইসলাম', duty: 'শৃঙ্খলা ও নিরাপত্তা ব্যবস্থা', phone: '01710002222' },
          { name: 'কারী আশরাফ আলী', duty: 'মাইক ও স্টেজ ডেকোরেশন', phone: '01710003333' }
        ],
        status: 'planned'
      },
      {
        id: 'evt-2',
        title: 'Annual Dastarbandi Conference (Hifz Completion Graduation)',
        titleBn: 'বার্ষিক খতমে কুরআন ও হিফজ সমাপনী দস্তারবন্দী মহাসম্মেলন',
        category: 'dastarbandi',
        eventDate: '2025-03-12',
        venue: 'মাদরাসা কেন্দ্রীয় অডিটোরিয়াম',
        chairperson: 'মুহতামিম মাওলানা আব্দুল হান্নান সাহেব',
        chiefGuest: 'শায়খুল হাদীস আল্লামা আব্দুল কুদ্দুস সাহেব',
        speakers: [
          { name: 'শায়খুল হাদীস আল্লামা আব্দুল কুদ্দুস', topic: 'হাফেজে কুরআনের সম্মান ও পিতা-মাতার মর্যাদা', time: 'রাত ৮:৩০', honorarium: 12000 }
        ],
        budget: 95000,
        totalCollection: 120000,
        totalExpense: 92000,
        volunteers: [
          { name: 'হাফেজ মামুনুর রশীদ', duty: 'পাগড়ি ও সম্মাননা স্মারক প্রস্তুত', phone: '01810004444' }
        ],
        status: 'completed'
      }
    ];
  });

  const [clubs, setClubs] = useState<CoCurricularClub[]>(() => {
    const saved = localStorage.getItem('madrasah_cocurricular_clubs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'club-1',
        name: 'Hifzul Quran & Qiraat Forum',
        nameBn: 'হিফজুল কুরআন ও হুসনুল কিরাত ফোরাম',
        category: 'quran_qiraat',
        convener: 'কারী আশরাফ আলী সাহেব',
        convenerPhone: '01710003333',
        membersCount: 45,
        meetingDay: 'প্রতি বৃহস্পতিবার আসর পর',
        activitiesCount: 8,
        description: 'সহীহ তালিম, তাজবীদ চর্চা এবং জাতীয় ও বিভাগীয় কিরাত প্রতিযোগিতার প্রস্তুতি।'
      },
      {
        id: 'club-2',
        name: 'Arabic & Bengali Literary Society',
        nameBn: 'আরবি ও বাংলা সাহিত্য ও দেয়ালিকা সংসদ',
        category: 'literature',
        convener: 'মাওলানা তাহের বিল্লাহ',
        convenerPhone: '01715556666',
        membersCount: 38,
        meetingDay: 'প্রতি শনিবার মাগরিব পর',
        activitiesCount: 6,
        description: 'ত্রৈমাসিক সাময়িকী, দেয়ালিকা প্রকাশনা ও আরবি মুক্ত কথন দক্ষতা বৃদ্ধি।'
      },
      {
        id: 'club-3',
        name: 'Debate, Public Speaking & Dawah Forum',
        nameBn: 'বিতর্ক, উপস্থিত বক্তৃতা ও ইসলামী দাওয়াহ ফোরাম',
        category: 'debate',
        convener: 'মাওলানা কামরুল ইসলাম',
        convenerPhone: '01718889999',
        membersCount: 32,
        meetingDay: 'প্রতি মঙ্গলবার যোহর পর',
        activitiesCount: 5,
        description: 'যুক্তিভিত্তিক বক্তৃতা, সমকালীন বিষয় নিয়ে গঠনমূলক বিতর্ক ও দাওয়াহ কর্মশালা।'
      }
    ];
  });

  // LocalStorage sync effects
  useEffect(() => {
    localStorage.setItem('madrasah_books_catalog', JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem('madrasah_book_issues', JSON.stringify(bookIssues));
  }, [bookIssues]);

  useEffect(() => {
    localStorage.setItem('madrasah_transport_vehicles', JSON.stringify(vehicles));
  }, [vehicles]);

  useEffect(() => {
    localStorage.setItem('madrasah_transport_roster', JSON.stringify(transportRoster));
  }, [transportRoster]);

  useEffect(() => {
    localStorage.setItem('madrasah_mahfil_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('madrasah_cocurricular_clubs', JSON.stringify(clubs));
  }, [clubs]);

  // ================= MODAL STATES =================
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showIssueBookModal, setShowIssueBookModal] = useState(false);
  const [selectedBookForIssue, setSelectedBookForIssue] = useState<BookItem | null>(null);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [printableSlip, setPrintableSlip] = useState<{ type: 'book_slip' | 'bus_pass' | 'event_pass'; data: any } | null>(null);

  // Filter States
  const [bookSearch, setBookSearch] = useState('');
  const [bookCategoryFilter, setBookCategoryFilter] = useState('all');
  const [issueStatusFilter, setIssueStatusFilter] = useState('all');

  // Add Book Form State
  const [newBook, setNewBook] = useState({
    title: '',
    titleBn: '',
    author: '',
    publisher: '',
    category: 'hadith' as BookItem['category'],
    almirah: 'আলমিরা-০১',
    shelf: 'র্যাক-১',
    totalCopies: 5,
    price: 350
  });

  // Issue Book Form State
  const [issueForm, setIssueForm] = useState({
    borrowerType: 'student' as 'student' | 'teacher',
    studentId: '',
    teacherName: '',
    phone: '',
    days: 14
  });

  // Add Vehicle Form State
  const [newVehicle, setNewVehicle] = useState({
    vehicleNo: '',
    vehicleType: 'bus' as TransportVehicle['vehicleType'],
    driverName: '',
    driverPhone: '',
    helperName: '',
    helperPhone: '',
    capacity: 25,
    routeName: '',
    stoppages: '',
    departureTime: '০৭:১৫ সকাল',
    returnTime: '০২:৩০ দুপুর',
    monthlyFee: 1500
  });

  // Add Event Form State
  const [newEvent, setNewEvent] = useState({
    title: '',
    titleBn: '',
    category: 'mahfil' as MahfilEvent['category'],
    eventDate: new Date().toISOString().split('T')[0],
    venue: 'মাদরাসা প্রাঙ্গণ',
    chairperson: 'মুহতামিম সাহেব',
    chiefGuest: '',
    budget: 100000,
    speakerName: '',
    speakerTopic: ''
  });

  // ================= METRICS COMPUTATION =================
  const metrics = useMemo(() => {
    const totalBookTitles = books.length;
    const totalCopies = books.reduce((acc, b) => acc + b.totalCopies, 0);
    const availableCopies = books.reduce((acc, b) => acc + b.availableCopies, 0);
    const activeIssues = bookIssues.filter(i => i.status === 'issued' || i.status === 'overdue').length;
    const overdueIssues = bookIssues.filter(i => i.status === 'overdue').length;
    const totalVehicles = vehicles.filter(v => v.status === 'active').length;
    const totalBusRiders = transportRoster.length;
    const upcomingEvents = events.filter(e => e.status === 'planned' || e.status === 'ongoing').length;
    const totalClubMembers = clubs.reduce((acc, c) => acc + c.membersCount, 0);

    return {
      totalBookTitles,
      totalCopies,
      availableCopies,
      activeIssues,
      overdueIssues,
      totalVehicles,
      totalBusRiders,
      upcomingEvents,
      totalClubMembers
    };
  }, [books, bookIssues, vehicles, transportRoster, events, clubs]);

  // Filtered Books
  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const matchSearch =
        b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
        b.titleBn.toLowerCase().includes(bookSearch.toLowerCase()) ||
        b.author.toLowerCase().includes(bookSearch.toLowerCase()) ||
        b.accessionNo.toLowerCase().includes(bookSearch.toLowerCase());
      const matchCat = bookCategoryFilter === 'all' || b.category === bookCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [books, bookSearch, bookCategoryFilter]);

  // Filtered Issues
  const filteredIssues = useMemo(() => {
    return bookIssues.filter(i => {
      if (issueStatusFilter === 'all') return true;
      return i.status === issueStatusFilter;
    });
  }, [bookIssues, issueStatusFilter]);

  // ================= ACTION HANDLERS =================
  const handleAddBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBook.titleBn && !newBook.title) return;

    const nextId = `book-${Date.now()}`;
    const nextAcc = `ACC-${1000 + books.length + 1}`;
    const bookToAdd: BookItem = {
      id: nextId,
      accessionNo: nextAcc,
      title: newBook.title || newBook.titleBn,
      titleBn: newBook.titleBn || newBook.title,
      author: newBook.author || 'অজ্ঞাত লেখক',
      publisher: newBook.publisher,
      category: newBook.category,
      almirah: newBook.almirah,
      shelf: newBook.shelf,
      totalCopies: Number(newBook.totalCopies) || 1,
      availableCopies: Number(newBook.totalCopies) || 1,
      price: Number(newBook.price) || 0,
      condition: 'new',
      entryDate: new Date().toISOString().split('T')[0]
    };

    setBooks([bookToAdd, ...books]);
    setShowAddBookModal(false);
    setNewBook({
      title: '',
      titleBn: '',
      author: '',
      publisher: '',
      category: 'hadith',
      almirah: 'আলমিরা-০১',
      shelf: 'র্যাক-১',
      totalCopies: 5,
      price: 350
    });
  };

  const handleOpenIssueModal = (book: BookItem) => {
    setSelectedBookForIssue(book);
    setShowIssueBookModal(true);
  };

  const handleIssueBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookForIssue || selectedBookForIssue.availableCopies <= 0) return;

    let bName = '';
    let bRoll: number | undefined;
    let bClass: string | undefined;
    let bPhone = issueForm.phone;

    if (issueForm.borrowerType === 'student') {
      const stud = students.find(s => s.id === issueForm.studentId);
      if (stud) {
        bName = stud.nameBn || stud.name;
        bRoll = stud.roll;
        bClass = stud.class || stud.classLevel;
        bPhone = stud.phone || stud.fatherPhone || issueForm.phone;
      } else {
        bName = 'সাধারণ শিক্ষার্থী';
      }
    } else {
      bName = issueForm.teacherName || 'সম্মানিত উস্তাদ';
    }

    const today = new Date();
    const issueDateStr = today.toISOString().split('T')[0];
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + Number(issueForm.days));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const newIssue: BookIssueRecord = {
      id: `issue-${Date.now()}`,
      bookId: selectedBookForIssue.id,
      bookTitle: selectedBookForIssue.titleBn || selectedBookForIssue.title,
      accessionNo: selectedBookForIssue.accessionNo,
      borrowerType: issueForm.borrowerType,
      borrowerId: issueForm.studentId || `tch-${Date.now()}`,
      borrowerName: bName,
      borrowerRoll: bRoll,
      borrowerClass: bClass,
      borrowerPhone: bPhone,
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      status: 'issued',
      fineAmount: 0
    };

    // Decrement available copies
    setBooks(prev =>
      prev.map(b => (b.id === selectedBookForIssue.id ? { ...b, availableCopies: Math.max(0, b.availableCopies - 1) } : b))
    );

    setBookIssues([newIssue, ...bookIssues]);
    setShowIssueBookModal(false);
    setSelectedBookForIssue(null);
  };

  const handleReturnBook = (issueId: string) => {
    const issue = bookIssues.find(i => i.id === issueId);
    if (!issue || issue.status === 'returned') return;

    const returnDateStr = new Date().toISOString().split('T')[0];

    setBookIssues(prev =>
      prev.map(i =>
        i.id === issueId
          ? {
              ...i,
              status: 'returned',
              returnDate: returnDateStr
            }
          : i
      )
    );

    // Increment available copies
    setBooks(prev =>
      prev.map(b => (b.id === issue.bookId ? { ...b, availableCopies: b.availableCopies + 1 } : b))
    );
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.vehicleNo || !newVehicle.routeName) return;

    const vehicleToAdd: TransportVehicle = {
      id: `veh-${Date.now()}`,
      vehicleNo: newVehicle.vehicleNo,
      vehicleType: newVehicle.vehicleType,
      driverName: newVehicle.driverName || 'ড্রাইভার',
      driverPhone: newVehicle.driverPhone || '01XXXXXXXXX',
      helperName: newVehicle.helperName,
      helperPhone: newVehicle.helperPhone,
      capacity: Number(newVehicle.capacity) || 20,
      routeName: newVehicle.routeName,
      stoppages: newVehicle.stoppages.split(',').map(s => s.trim()).filter(Boolean),
      departureTime: newVehicle.departureTime,
      returnTime: newVehicle.returnTime,
      monthlyFee: Number(newVehicle.monthlyFee) || 1200,
      status: 'active'
    };

    setVehicles([vehicleToAdd, ...vehicles]);
    setShowAddVehicleModal(false);
    setNewVehicle({
      vehicleNo: '',
      vehicleType: 'bus',
      driverName: '',
      driverPhone: '',
      helperName: '',
      helperPhone: '',
      capacity: 25,
      routeName: '',
      stoppages: '',
      departureTime: '০৭:১৫ সকাল',
      returnTime: '০২:৩০ দুপুর',
      monthlyFee: 1500
    });
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.titleBn && !newEvent.title) return;

    const eventToAdd: MahfilEvent = {
      id: `evt-${Date.now()}`,
      title: newEvent.title || newEvent.titleBn,
      titleBn: newEvent.titleBn || newEvent.title,
      category: newEvent.category,
      eventDate: newEvent.eventDate,
      venue: newEvent.venue,
      chairperson: newEvent.chairperson,
      chiefGuest: newEvent.chiefGuest || 'বিশিষ্ট ইসলামী চিন্তাবিদ',
      speakers: newEvent.speakerName
        ? [{ name: newEvent.speakerName, topic: newEvent.speakerTopic || 'সাধারণ নসীহত', time: 'বাদ মাগরিব', honorarium: 5000 }]
        : [],
      budget: Number(newEvent.budget) || 50000,
      totalCollection: 0,
      totalExpense: 0,
      volunteers: [],
      status: 'planned'
    };

    setEvents([eventToAdd, ...events]);
    setShowAddEventModal(false);
    setNewEvent({
      title: '',
      titleBn: '',
      category: 'mahfil',
      eventDate: new Date().toISOString().split('T')[0],
      venue: 'মাদরাসা প্রাঙ্গণ',
      chairperson: 'মুহতামিম সাহেব',
      chiefGuest: '',
      budget: 100000,
      speakerName: '',
      speakerTopic: ''
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`p-3 sm:p-6 space-y-6 ${language === 'bn' ? 'font-bangla' : ''}`}>
      {/* ================= HEADER SECTION ================= */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shadow-xs">
              <Library className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                  {language === 'bn' ? '১০. কিতাব ও লাইব্রেরি, পরিবহন ও মাহফিল হাব' : '10. Library, Transport & Events Hub'}
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {language === 'bn' ? 'ধাপ ১০ সক্রিয়' : 'Step 10 Active'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {language === 'bn'
                  ? 'কিতাব ক্যাটালগ ও ধার রেজিস্টার, পরিবহন বহর ও রুট, বার্ষিক মাহফিল/জলসা ও সহশিক্ষা ক্লাব ব্যবস্থাপনা'
                  : 'Kitab Bank, Book Lending, Transport Fleet, Annual Mahfil, Conferences & Co-Curricular Club Suite'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                if (activeSubTab === 'book_bank') setShowAddBookModal(true);
                else if (activeSubTab === 'transport_fleet') setShowAddVehicleModal(true);
                else if (activeSubTab === 'mahfil_events') setShowAddEventModal(true);
                else setShowAddBookModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activeSubTab === 'book_bank'
                  ? (language === 'bn' ? 'নতুন কিতাব যোগ করুন' : 'Add New Book')
                  : activeSubTab === 'transport_fleet'
                  ? (language === 'bn' ? 'নতুন যানবাহন/রুট যোগ' : 'Add Vehicle/Route')
                  : activeSubTab === 'mahfil_events'
                  ? (language === 'bn' ? 'নতুন মাহফিল/ইভেন্ট যোগ' : 'Create Mahfil Event')
                  : (language === 'bn' ? 'নতুন রেকর্ড যোগ' : 'Add Record')}
              </span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'bn' ? 'রিপোর্ট প্রিন্ট' : 'Print'}</span>
            </button>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <span className="text-xs text-slate-500 font-medium block">
              {language === 'bn' ? 'মোট কিতাব পদবি' : 'Total Book Titles'}
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold text-slate-800">
                {language === 'bn' ? toBengali(metrics.totalBookTitles) : metrics.totalBookTitles}
              </span>
              <span className="text-xs text-slate-400">
                ({language === 'bn' ? toBengali(metrics.totalCopies) : metrics.totalCopies} {language === 'bn' ? 'কপি' : 'copies'})
              </span>
            </div>
          </div>

          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
            <span className="text-xs text-emerald-700 font-medium block">
              {language === 'bn' ? 'উপলব্ধ কিতাব' : 'Available on Shelf'}
            </span>
            <span className="text-xl font-bold text-emerald-800 mt-1 block">
              {language === 'bn' ? toBengali(metrics.availableCopies) : metrics.availableCopies}
            </span>
          </div>

          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100">
            <span className="text-xs text-amber-700 font-medium block">
              {language === 'bn' ? 'চলমান ধার/ইস্যু' : 'Active Borrowed'}
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold text-amber-800">
                {language === 'bn' ? toBengali(metrics.activeIssues) : metrics.activeIssues}
              </span>
              {metrics.overdueIssues > 0 && (
                <span className="text-xs font-semibold text-rose-600">
                  ({language === 'bn' ? toBengali(metrics.overdueIssues) : metrics.overdueIssues} {language === 'bn' ? 'দেরি' : 'late'})
                </span>
              )}
            </div>
          </div>

          <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
            <span className="text-xs text-blue-700 font-medium block">
              {language === 'bn' ? 'পরিবহন বহর ও রুট' : 'Vehicles & Routes'}
            </span>
            <span className="text-xl font-bold text-blue-800 mt-1 block">
              {language === 'bn' ? toBengali(metrics.totalVehicles) : metrics.totalVehicles}
            </span>
          </div>

          <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
            <span className="text-xs text-indigo-700 font-medium block">
              {language === 'bn' ? 'আসন্ন মাহফিল/ইভেন্ট' : 'Upcoming Mahfils'}
            </span>
            <span className="text-xl font-bold text-indigo-800 mt-1 block">
              {language === 'bn' ? toBengali(metrics.upcomingEvents) : metrics.upcomingEvents}
            </span>
          </div>

          <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-100">
            <span className="text-xs text-purple-700 font-medium block">
              {language === 'bn' ? 'ক্লাব সদস্য সংখ্যা' : 'Club Members'}
            </span>
            <span className="text-xl font-bold text-purple-800 mt-1 block">
              {language === 'bn' ? toBengali(metrics.totalClubMembers) : metrics.totalClubMembers}
            </span>
          </div>
        </div>

        {/* SUB NAVIGATION TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pt-5 mt-4 border-t border-slate-100 no-scrollbar">
          {[
            {
              id: 'book_bank',
              label: language === 'bn' ? 'কিতাব ব্যাংক ও লাইব্রেরি' : 'Kitab Bank & Library',
              icon: BookOpen,
              count: books.length
            },
            {
              id: 'book_issues',
              label: language === 'bn' ? 'ইস্যু ও ফেরত রেজিস্টার' : 'Issues & Returns',
              icon: Library,
              count: bookIssues.filter(i => i.status === 'issued').length
            },
            {
              id: 'transport_fleet',
              label: language === 'bn' ? 'পরিবহন বহর ও বাস রুট' : 'Transport Fleet & Routes',
              icon: Bus,
              count: vehicles.length
            },
            {
              id: 'mahfil_events',
              label: language === 'bn' ? 'বার্ষিক মাহফিল ও সমাবেশ' : 'Annual Mahfil & Events',
              icon: CalendarDays,
              count: events.length
            },
            {
              id: 'activities_clubs',
              label: language === 'bn' ? 'সহশিক্ষা ও ক্লাব ফোরাম' : 'Co-Curricular & Clubs',
              icon: Trophy,
              count: clubs.length
            }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-2xs font-bold ${
                    isActive ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {language === 'bn' ? toBengali(tab.count) : tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= TAB 1: BOOK BANK & CATALOG ================= */}
      {activeSubTab === 'book_bank' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bookSearch}
                onChange={e => setBookSearch(e.target.value)}
                placeholder={language === 'bn' ? 'কিতাবের নাম, লেখক বা অ্যাকসেশন নম্বর খুঁজুন...' : 'Search books, authors, accession...'}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={bookCategoryFilter}
                onChange={e => setBookCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">{language === 'bn' ? 'সকল বিভাগ' : 'All Categories'}</option>
                <option value="quran">{language === 'bn' ? 'কুরআন ও কিরাত' : 'Quran & Qiraat'}</option>
                <option value="tafsir">{language === 'bn' ? 'তাফসীর শরীফ' : 'Tafsir'}</option>
                <option value="hadith">{language === 'bn' ? 'হাদীস শাস্ত্র' : 'Hadith'}</option>
                <option value="fiqh">{language === 'bn' ? 'ফিকহ ও ফতোয়া' : 'Fiqh & Fatawa'}</option>
                <option value="arabic">{language === 'bn' ? 'আরবি আদব ও ব্যাকরণ' : 'Arabic Literature'}</option>
                <option value="general">{language === 'bn' ? 'সাধারণ পাঠ্য ও রেফারেন্স' : 'General & Academic'}</option>
              </select>

              <button
                onClick={() => setShowAddBookModal(true)}
                className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'bn' ? 'নতুন কিতাব' : 'Add Book'}</span>
              </button>
            </div>
          </div>

          {/* Book Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBooks.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
                <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">{language === 'bn' ? 'কোনো কিতাব পাওয়া যায়নি' : 'No books found'}</p>
              </div>
            ) : (
              filteredBooks.map(book => (
                <div
                  key={book.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-2xs font-mono font-bold border border-slate-200">
                        {book.accessionNo}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                          book.availableCopies > 0
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {book.availableCopies > 0
                          ? (language === 'bn' ? `উপলব্ধ: ${toBengali(book.availableCopies)}` : `Available: ${book.availableCopies}`)
                          : (language === 'bn' ? 'সব ইস্যুকৃত' : 'All Issued')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-800 mt-2.5 line-clamp-1">
                      {book.titleBn}
                    </h3>
                    <p className="text-xs text-slate-500 italic mt-0.5 line-clamp-1">{book.title}</p>

                    <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{language === 'bn' ? 'লেখক/মুসান্নিফ:' : 'Author:'}</span>
                        <span className="font-medium text-slate-700">{book.author}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{language === 'bn' ? 'স্থান/অবস্থান:' : 'Shelf/Almirah:'}</span>
                        <span className="font-medium text-slate-700">
                          {book.almirah}, {book.shelf}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{language === 'bn' ? 'মোট কপি:' : 'Total Copies:'}</span>
                        <span className="font-semibold text-slate-800">
                          {language === 'bn' ? toBengali(book.totalCopies) : book.totalCopies} {language === 'bn' ? 'কপি' : 'copies'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setPrintableSlip({
                          type: 'book_slip',
                          data: book
                        });
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === 'bn' ? 'লেবেল প্রিন্ট' : 'Label'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenIssueModal(book)}
                      disabled={book.availableCopies <= 0}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        book.availableCopies > 0
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'ইস্যু করুন' : 'Issue Book'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: BOOK ISSUES & RETURNS ================= */}
      {activeSubTab === 'book_issues' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">{language === 'bn' ? 'ফিল্টার:' : 'Filter:'}</span>
              {(['all', 'issued', 'overdue', 'returned'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setIssueStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    issueStatusFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all'
                    ? (language === 'bn' ? 'সকল' : 'All')
                    : st === 'issued'
                    ? (language === 'bn' ? 'চলমান ধার' : 'Issued')
                    : st === 'overdue'
                    ? (language === 'bn' ? 'দেরি/মেয়াদোত্তীর্ণ' : 'Overdue')
                    : (language === 'bn' ? 'ফেরত সম্পন্ন' : 'Returned')}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (books.length > 0) {
                  const firstAvail = books.find(b => b.availableCopies > 0) || books[0];
                  handleOpenIssueModal(firstAvail);
                }
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'bn' ? 'নতুন কিতাব ইস্যু' : 'New Book Issue'}</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-2xs tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{language === 'bn' ? 'কিতাব ও কোড' : 'Book & Accession'}</th>
                    <th className="py-3 px-4">{language === 'bn' ? 'গ্রহীতার নাম ও শ্রেণি' : 'Borrower & Class'}</th>
                    <th className="py-3 px-4">{language === 'bn' ? 'ইস্যুর তারিখ' : 'Issue Date'}</th>
                    <th className="py-3 px-4">{language === 'bn' ? 'ফেরতের শেষ তারিখ' : 'Due Date'}</th>
                    <th className="py-3 px-4">{language === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                    <th className="py-3 px-4 text-right">{language === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredIssues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        {language === 'bn' ? 'কোনো ইস্যু রেকর্ড পাওয়া যায়নি' : 'No issue records found'}
                      </td>
                    </tr>
                  ) : (
                    filteredIssues.map(issue => (
                      <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 block">{issue.bookTitle}</span>
                          <span className="text-2xs font-mono text-slate-400">{issue.accessionNo}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{issue.borrowerName}</div>
                          <div className="text-2xs text-slate-500">
                            {issue.borrowerClass || (issue.borrowerType === 'teacher' ? 'উস্তাদ' : '')}
                            {issue.borrowerRoll ? ` (রোল: ${toBengali(issue.borrowerRoll)})` : ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{formatSafeDate(issue.issueDate)}</td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{formatSafeDate(issue.dueDate)}</td>
                        <td className="py-3.5 px-4">
                          {issue.status === 'returned' ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                              {language === 'bn' ? 'ফেরত সম্পন্ন' : 'Returned'}
                            </span>
                          ) : issue.status === 'overdue' ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200">
                              {language === 'bn' ? 'দেরি / মেয়াদোত্তীর্ণ' : 'Overdue'}
                              {issue.fineAmount ? ` (৳${issue.fineAmount})` : ''}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                              {language === 'bn' ? 'চলমান' : 'Active'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {issue.status !== 'returned' ? (
                            <button
                              onClick={() => handleReturnBook(issue.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              {language === 'bn' ? 'ফেরত নিন' : 'Mark Return'}
                            </button>
                          ) : (
                            <span className="text-2xs text-slate-400 font-mono">
                              {language === 'bn' ? `ফেরত: ${formatSafeDate(issue.returnDate || '')}` : `Returned`}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: TRANSPORT FLEET & ROUTES ================= */}
      {activeSubTab === 'transport_fleet' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {language === 'bn' ? 'পরিবহন বহর ও ছাত্র বাস রুট' : 'Transport Fleet & Student Routes'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'bn'
                  ? 'মাদরাসা/স্কুলের যানবাহন, ড্রাইভার, পিকআপ স্টপেজ ও শিক্ষার্থীদের মাসিক যাতায়াত তালিকা'
                  : 'Manage vehicle fleet, drivers, pick-up stoppages and monthly student transport allocations'}
              </p>
            </div>
            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'bn' ? 'নতুন যানবাহন/রুট' : 'Add Vehicle'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.map(veh => (
              <div
                key={veh.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 font-bold">
                      <Bus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base">{veh.routeName}</h3>
                      <span className="text-xs font-mono text-slate-500 font-semibold">{veh.vehicleNo}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {language === 'bn' ? 'সক্রিয় রুট' : 'Active'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-2xs">{language === 'bn' ? 'ড্রাইভার:' : 'Driver:'}</span>
                    <span className="font-semibold text-slate-800">{veh.driverName}</span>
                    <span className="text-slate-500 text-2xs block font-mono">{veh.driverPhone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-2xs">{language === 'bn' ? 'সিট ক্যাপাসিটি:' : 'Capacity:'}</span>
                    <span className="font-semibold text-slate-800">
                      {language === 'bn' ? toBengali(veh.capacity) : veh.capacity} {language === 'bn' ? 'জন' : 'Seats'}
                    </span>
                    <span className="text-emerald-700 text-2xs block font-semibold">
                      ৳{language === 'bn' ? toBengali(veh.monthlyFee) : veh.monthlyFee} / {language === 'bn' ? 'মাসিক' : 'mo'}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5">
                  <span className="text-2xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                    {language === 'bn' ? 'স্টপেজ ও সময়সূচি:' : 'Stoppages & Schedule:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {veh.stoppages.map((stop, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-2xs font-medium border border-slate-200 flex items-center gap-1"
                      >
                        <MapPin className="w-2.5 h-2.5 text-blue-500" />
                        <span>{stop}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-2xs text-slate-500 flex items-center justify-between font-mono">
                    <span>{language === 'bn' ? `রওনা: ${veh.departureTime}` : `Dep: ${veh.departureTime}`}</span>
                    <span>{language === 'bn' ? `ফেরত: ${veh.returnTime}` : `Ret: ${veh.returnTime}`}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Student Transport Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">
                {language === 'bn' ? 'পরিবহন গ্রহণকারী শিক্ষার্থী তালিকা' : 'Student Transport Enrollment'}
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                {language === 'bn' ? `মোট: ${toBengali(transportRoster.length)} জন` : `Total: ${transportRoster.length}`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 uppercase text-2xs tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">{language === 'bn' ? 'শিক্ষার্থী' : 'Student'}</th>
                    <th className="py-2.5 px-4">{language === 'bn' ? 'শ্রেণি ও রোল' : 'Class & Roll'}</th>
                    <th className="py-2.5 px-4">{language === 'bn' ? 'স্টপেজ' : 'Stoppage'}</th>
                    <th className="py-2.5 px-4">{language === 'bn' ? 'পিকআপ সময়' : 'Pickup Time'}</th>
                    <th className="py-2.5 px-4">{language === 'bn' ? 'মাসিক ফি' : 'Monthly Fee'}</th>
                    <th className="py-2.5 px-4 text-right">{language === 'bn' ? 'বাস পাস' : 'Bus Pass'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {transportRoster.map(tr => (
                    <tr key={tr.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">{tr.studentName}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {tr.studentClass} (রোল: {toBengali(tr.studentRoll)})
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{tr.stoppage}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{tr.pickupTime}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                            tr.feeStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tr.feeStatus === 'paid' ? (language === 'bn' ? 'পরিশোধিত' : 'Paid') : (language === 'bn' ? 'বকেয়া' : 'Due')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setPrintableSlip({
                              type: 'bus_pass',
                              data: tr
                            });
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          {language === 'bn' ? 'পাস প্রিন্ট' : 'Print Pass'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: MAHFIL & EVENTS ================= */}
      {activeSubTab === 'mahfil_events' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {language === 'bn' ? 'বার্ষিক মাহফিল, জলসা ও সমাবেশ ব্যবস্থাপনা' : 'Annual Mahfil & Institutional Events'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'bn'
                  ? 'বার্ষিক মাহফিল, খতমে কুরআন, দস্তারবন্দী, বক্তা তালিকা, স্বেচ্ছাসেবক ও আর্থিক বাজেট ট্র্যাকিং'
                  : 'Manage annual gatherings, speakers, volunteer committees, and event collection/expense budgets'}
              </p>
            </div>
            <button
              onClick={() => setShowAddEventModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'bn' ? 'নতুন মাহফিল/ইভেন্ট' : 'Plan Event'}</span>
            </button>
          </div>

          <div className="space-y-4">
            {events.map(evt => (
              <div
                key={evt.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {evt.category === 'mahfil'
                          ? (language === 'bn' ? 'বার্ষিক মাহফিল' : 'Annual Mahfil')
                          : evt.category === 'dastarbandi'
                          ? (language === 'bn' ? 'দস্তারবন্দী সম্মেলন' : 'Dastarbandi')
                          : evt.category === 'seerat'
                          ? (language === 'bn' ? 'সীরাত মাহফিল' : 'Seerat Mahfil')
                          : (language === 'bn' ? 'বিশেষ সমাবেশ' : 'Special Event')}
                      </span>
                      <span className="text-xs text-slate-500 font-mono font-medium">
                        {formatSafeDate(evt.eventDate)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">{evt.titleBn}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{evt.venue}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        evt.status === 'completed'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {evt.status === 'completed'
                        ? (language === 'bn' ? 'সম্পন্ন' : 'Completed')
                        : (language === 'bn' ? 'আসন্ন / পরিকল্পিত' : 'Planned')}
                    </span>
                    <button
                      onClick={() => {
                        setPrintableSlip({
                          type: 'event_pass',
                          data: evt
                        });
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'আমন্ত্রণপত্র' : 'Invitation'}</span>
                    </button>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-2xs">{language === 'bn' ? 'মোট বাজেট:' : 'Budget:'}</span>
                    <span className="font-bold text-slate-800 text-sm">৳{formatNumber(evt.budget)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-2xs">{language === 'bn' ? 'চাঁদা কালেকশন:' : 'Collection:'}</span>
                    <span className="font-bold text-emerald-700 text-sm">৳{formatNumber(evt.totalCollection)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-2xs">{language === 'bn' ? 'মোট ব্যয়:' : 'Expenses:'}</span>
                    <span className="font-bold text-slate-800 text-sm">৳{formatNumber(evt.totalExpense)}</span>
                  </div>
                </div>

                {/* Speakers Strip */}
                {evt.speakers.length > 0 && (
                  <div>
                    <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      {language === 'bn' ? 'সম্মানিত বক্তা ও মেহমানবৃন্দ:' : 'Honorable Guest Speakers:'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {evt.speakers.map((spk, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl border border-slate-100 bg-white shadow-2xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-xs text-slate-800 block">{spk.name}</span>
                            <span className="text-2xs text-slate-500">{spk.topic}</span>
                          </div>
                          <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {spk.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 5: CO-CURRICULAR & CLUBS ================= */}
      {activeSubTab === 'activities_clubs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {language === 'bn' ? 'সহশিক্ষা ও ছাত্র ক্লাব ফোরাম' : 'Co-Curricular Clubs & Student Societies'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'bn'
                  ? 'হুসনুল কিরাত ফোরাম, আরবি/বাংলা দেয়ালিকা সাহিত্য সংসদ, বিতর্ক ক্লাব ও প্রতিযোগিতা'
                  : 'Manage Quran recitation, literary societies, debate forums, and student competitions'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {clubs.map(club => (
              <div
                key={club.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100 mb-3">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">{club.nameBn}</h3>
                  <p className="text-xs text-slate-400 italic">{club.name}</p>
                  <p className="text-xs text-slate-600 mt-2.5 line-clamp-3">{club.description}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">{language === 'bn' ? 'আহ্বায়ক:' : 'Convener:'}</span>
                    <span className="font-medium text-slate-800">{club.convener}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">{language === 'bn' ? 'সদস্য সংখ্যা:' : 'Members:'}</span>
                    <span className="font-bold text-purple-700">
                      {language === 'bn' ? toBengali(club.membersCount) : club.membersCount} {language === 'bn' ? 'জন' : 'students'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">{language === 'bn' ? 'সাপ্তাহিক বৈঠক:' : 'Meeting:'}</span>
                    <span className="font-medium text-slate-700 text-2xs">{club.meetingDay}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD BOOK ================= */}
      {showAddBookModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">
                {language === 'bn' ? 'নতুন কিতাব / বই ক্যাটালগে অন্তর্ভুক্ত করুন' : 'Add New Book to Catalog'}
              </h3>
              <button
                onClick={() => setShowAddBookModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBook} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {language === 'bn' ? 'কিতাবের নাম (বাংলায়) *' : 'Book Title (Bangla) *'}
                </label>
                <input
                  type="text"
                  required
                  value={newBook.titleBn}
                  onChange={e => setNewBook({ ...newBook, titleBn: e.target.value })}
                  placeholder="যেমন: সহীহুল বুখারী (১ম খণ্ড)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'ইংরেজি নাম' : 'English Title'}
                  </label>
                  <input
                    type="text"
                    value={newBook.title}
                    onChange={e => setNewBook({ ...newBook, title: e.target.value })}
                    placeholder="Sahih al-Bukhari"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'লেখক / মুসান্নিফ *' : 'Author / Writer *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newBook.author}
                    onChange={e => setNewBook({ ...newBook, author: e.target.value })}
                    placeholder="ইমাম বুখারী (রহ.)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'বিভাগ' : 'Category'}
                  </label>
                  <select
                    value={newBook.category}
                    onChange={e => setNewBook({ ...newBook, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="hadith">{language === 'bn' ? 'হাদীস' : 'Hadith'}</option>
                    <option value="fiqh">{language === 'bn' ? 'ফিকহ' : 'Fiqh'}</option>
                    <option value="tafsir">{language === 'bn' ? 'তাফসীর' : 'Tafsir'}</option>
                    <option value="arabic">{language === 'bn' ? 'আরবি আদব' : 'Arabic'}</option>
                    <option value="quran">{language === 'bn' ? 'কুরআন' : 'Quran'}</option>
                    <option value="general">{language === 'bn' ? 'সাধারণ' : 'General'}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'আলমিরা' : 'Almirah'}
                  </label>
                  <input
                    type="text"
                    value={newBook.almirah}
                    onChange={e => setNewBook({ ...newBook, almirah: e.target.value })}
                    placeholder="আলমিরা-০১"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'র্যাক/তাক' : 'Shelf'}
                  </label>
                  <input
                    type="text"
                    value={newBook.shelf}
                    onChange={e => setNewBook({ ...newBook, shelf: e.target.value })}
                    placeholder="র্যাক-২"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'মোট কপি সংখ্যা *' : 'Total Copies *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newBook.totalCopies}
                    onChange={e => setNewBook({ ...newBook, totalCopies: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'মূল্য (ঐচ্ছিক)' : 'Price'}
                  </label>
                  <input
                    type="number"
                    value={newBook.price}
                    onChange={e => setNewBook({ ...newBook, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBookModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                >
                  {language === 'bn' ? 'সংরক্ষণ করুন' : 'Save Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ISSUE BOOK ================= */}
      {showIssueBookModal && selectedBookForIssue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-800">
                  {language === 'bn' ? 'কিতাব ইস্যু করুন' : 'Issue Book'}
                </h3>
                <span className="text-xs text-slate-500">{selectedBookForIssue.titleBn}</span>
              </div>
              <button
                onClick={() => setShowIssueBookModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueBookSubmit} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {language === 'bn' ? 'গ্রহীতার ধরন' : 'Borrower Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIssueForm({ ...issueForm, borrowerType: 'student' })}
                    className={`py-2 text-center rounded-xl font-semibold cursor-pointer transition-colors ${
                      issueForm.borrowerType === 'student'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {language === 'bn' ? 'শিক্ষার্থী' : 'Student'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueForm({ ...issueForm, borrowerType: 'teacher' })}
                    className={`py-2 text-center rounded-xl font-semibold cursor-pointer transition-colors ${
                      issueForm.borrowerType === 'teacher'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {language === 'bn' ? 'উস্তাদ / শিক্ষক' : 'Teacher / Ustadh'}
                  </button>
                </div>
              </div>

              {issueForm.borrowerType === 'student' ? (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন *' : 'Select Student *'}
                  </label>
                  <select
                    required
                    value={issueForm.studentId}
                    onChange={e => setIssueForm({ ...issueForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">{language === 'bn' ? '-- শিক্ষার্থী নির্বাচন করুন --' : '-- Select Student --'}</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nameBn || s.name} (রোল: {s.roll}, শ্রেণি: {s.class || s.classLevel})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'উস্তাদের নাম *' : 'Teacher Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={issueForm.teacherName}
                    onChange={e => setIssueForm({ ...issueForm, teacherName: e.target.value })}
                    placeholder="মাওলানা সাইফুল ইসলাম"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}
                  </label>
                  <input
                    type="tel"
                    value={issueForm.phone}
                    onChange={e => setIssueForm({ ...issueForm, phone: e.target.value })}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'ধার নেওয়ার মেয়াদ (দিন)' : 'Duration (Days)'}
                  </label>
                  <select
                    value={issueForm.days}
                    onChange={e => setIssueForm({ ...issueForm, days: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value={7}>৭ দিন (1 Week)</option>
                    <option value={14}>১৪ দিন (2 Weeks)</option>
                    <option value={30}>৩০ দিন (1 Month)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIssueBookModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                >
                  {language === 'bn' ? 'ইস্যু নিশ্চিত করুন' : 'Confirm Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD VEHICLE ================= */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">
                {language === 'bn' ? 'নতুন যানবাহন ও রুট যুক্ত করুন' : 'Add Vehicle & Transport Route'}
              </h3>
              <button
                onClick={() => setShowAddVehicleModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'যানবাহন নম্বর *' : 'Vehicle Plate No *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newVehicle.vehicleNo}
                    onChange={e => setNewVehicle({ ...newVehicle, vehicleNo: e.target.value })}
                    placeholder="ঢাকা মেট্রো-চ-১২-৩৪৫৬"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'যানবাহন ধরন' : 'Vehicle Type'}
                  </label>
                  <select
                    value={newVehicle.vehicleType}
                    onChange={e => setNewVehicle({ ...newVehicle, vehicleType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="minibus">মিনিবাস (Minibus)</option>
                    <option value="microbus">মাইক্রোবাস (Microbus)</option>
                    <option value="bus">বড় বাস (Big Bus)</option>
                    <option value="van">ভ্যান / ইজিবাইক (Van)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {language === 'bn' ? 'রুটের নাম *' : 'Route Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={newVehicle.routeName}
                  onChange={e => setNewVehicle({ ...newVehicle, routeName: e.target.value })}
                  placeholder="যেমন: রুট ০১: উত্তরা - আজমপুর - ক্যাম্পাস"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {language === 'bn' ? 'স্টপেজ তালিকা (কমা দিয়ে লিখুন)' : 'Stoppages (Comma separated)'}
                </label>
                <input
                  type="text"
                  value={newVehicle.stoppages}
                  onChange={e => setNewVehicle({ ...newVehicle, stoppages: e.target.value })}
                  placeholder="হাউজবিল্ডিং, আজমপুর, বিমানবন্দর, মাদরাসা মেইন গেট"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'ড্রাইভারের নাম' : 'Driver Name'}
                  </label>
                  <input
                    type="text"
                    value={newVehicle.driverName}
                    onChange={e => setNewVehicle({ ...newVehicle, driverName: e.target.value })}
                    placeholder="মো. রফিকুল ইসলাম"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'ড্রাইভার মোবাইল' : 'Driver Phone'}
                  </label>
                  <input
                    type="tel"
                    value={newVehicle.driverPhone}
                    onChange={e => setNewVehicle({ ...newVehicle, driverPhone: e.target.value })}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'সিট সংখ্যা' : 'Seats'}
                  </label>
                  <input
                    type="number"
                    min="5"
                    value={newVehicle.capacity}
                    onChange={e => setNewVehicle({ ...newVehicle, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'মাসিক ভাড়া (টাকা)' : 'Monthly Fare'}
                  </label>
                  <input
                    type="number"
                    value={newVehicle.monthlyFee}
                    onChange={e => setNewVehicle({ ...newVehicle, monthlyFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                >
                  {language === 'bn' ? 'সংরক্ষণ করুন' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD MAHFIL EVENT ================= */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">
                {language === 'bn' ? 'নতুন মাহফিল / অনুষ্ঠান পরিকল্পনা' : 'Plan New Mahfil / Event'}
              </h3>
              <button
                onClick={() => setShowAddEventModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {language === 'bn' ? 'অনুষ্ঠানের নাম (বাংলায়) *' : 'Event Title (Bangla) *'}
                </label>
                <input
                  type="text"
                  required
                  value={newEvent.titleBn}
                  onChange={e => setNewEvent({ ...newEvent, titleBn: e.target.value })}
                  placeholder="যেমন: বার্ষিক সীরাতুন্নবী (সা.) মাহফিল ও পুরস্কার বিতরণী"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'ইভেন্ট ক্যাটাগরি' : 'Category'}
                  </label>
                  <select
                    value={newEvent.category}
                    onChange={e => setNewEvent({ ...newEvent, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="mahfil">বার্ষিক মাহফিল ও জলসা</option>
                    <option value="dastarbandi">দস্তারবন্দী মহাসম্মেলন</option>
                    <option value="seerat">সীরাতুন্নবী (সা.) মাহফিল</option>
                    <option value="sports">বার্ষিক ক্রীড়া ও সাংস্কৃতিক</option>
                    <option value="competition">হিফজ ও কেরাত প্রতিযোগিতা</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'অনুষ্ঠানের তারিখ *' : 'Event Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newEvent.eventDate}
                    onChange={e => setNewEvent({ ...newEvent, eventDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'স্থান / ভেন্যু' : 'Venue'}
                  </label>
                  <input
                    type="text"
                    value={newEvent.venue}
                    onChange={e => setNewEvent({ ...newEvent, venue: e.target.value })}
                    placeholder="মাদরাসা প্রাঙ্গণ"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'সভাপতি' : 'Chairperson'}
                  </label>
                  <input
                    type="text"
                    value={newEvent.chairperson}
                    onChange={e => setNewEvent({ ...newEvent, chairperson: e.target.value })}
                    placeholder="মুহতামিম সাহেব"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'প্রধান মেহমান / বক্তা' : 'Chief Guest'}
                  </label>
                  <input
                    type="text"
                    value={newEvent.chiefGuest}
                    onChange={e => setNewEvent({ ...newEvent, chiefGuest: e.target.value })}
                    placeholder="আল্লামা মুফতী মাহমুদুল হাসান"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {language === 'bn' ? 'আনুমানিক বাজেট (টাকা)' : 'Budget (BDT)'}
                  </label>
                  <input
                    type="number"
                    value={newEvent.budget}
                    onChange={e => setNewEvent({ ...newEvent, budget: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                >
                  {language === 'bn' ? 'ইভেন্ট সংরক্ষণ' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PRINT SLIP PREVIEW ================= */}
      {printableSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm sm:text-base">
                {printableSlip.type === 'book_slip'
                  ? (language === 'bn' ? 'কিতাব বারকোড ও বুক লেবেল' : 'Book Spine Label')
                  : printableSlip.type === 'bus_pass'
                  ? (language === 'bn' ? 'ছাত্র পরিবহন পরিচয়পত্র ও বাস পাস' : 'Student Transport Bus Pass')
                  : (language === 'bn' ? 'মাহফিল আমন্ত্রণপত্র ও শিডিউল' : 'Mahfil Invitation Card')}
              </h3>
              <button
                onClick={() => setPrintableSlip(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 p-4 rounded-xl border border-slate-200 bg-slate-50 text-center space-y-2">
              <h4 className="font-bold text-base text-slate-900">
                {schoolProfile.nameBn || schoolProfile.name || 'মাদরাসা পরিচালনা পরিষদ'}
              </h4>
              <p className="text-2xs text-slate-500">{schoolProfile.address || 'বাংলাদেশ'}</p>
              <div className="w-full h-px bg-slate-200 my-2" />

              {printableSlip.type === 'book_slip' && (
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-sm text-indigo-900">{printableSlip.data.titleBn}</p>
                  <p className="text-slate-600">{printableSlip.data.author}</p>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 inline-block font-mono font-bold text-slate-800 mt-2">
                    {printableSlip.data.accessionNo}
                  </div>
                  <p className="text-2xs text-slate-500 mt-1">
                    {printableSlip.data.almirah} | {printableSlip.data.shelf}
                  </p>
                </div>
              )}

              {printableSlip.type === 'bus_pass' && (
                <div className="space-y-1.5 text-xs text-left">
                  <div className="text-center font-bold text-sm text-blue-900 mb-2">
                    {language === 'bn' ? 'ছাত্র বাস পাস (TRANSPORT PASS)' : 'Student Transport Pass'}
                  </div>
                  <div><span className="text-slate-500">নাম:</span> <span className="font-bold">{printableSlip.data.studentName}</span></div>
                  <div><span className="text-slate-500">শ্রেণি ও রোল:</span> <span>{printableSlip.data.studentClass} (রোল: {printableSlip.data.studentRoll})</span></div>
                  <div><span className="text-slate-500">স্টপেজ:</span> <span className="font-bold text-blue-700">{printableSlip.data.stoppage}</span></div>
                  <div><span className="text-slate-500">পিকআপ সময়:</span> <span className="font-mono">{printableSlip.data.pickupTime}</span></div>
                  <div className="text-2xs text-emerald-700 font-semibold mt-2 text-center">বৈধতার মেয়াদ: চলমান শিক্ষাবর্ষ</div>
                </div>
              )}

              {printableSlip.type === 'event_pass' && (
                <div className="space-y-2 text-xs text-center">
                  <p className="font-bold text-sm text-indigo-900">{printableSlip.data.titleBn}</p>
                  <p className="text-slate-600">তারিখ: {formatSafeDate(printableSlip.data.eventDate)}</p>
                  <p className="text-slate-600">স্থান: {printableSlip.data.venue}</p>
                  <p className="text-2xs text-slate-500 mt-2">আপনার উপস্থিতি ও দোয়াই আমাদের একান্ত কাম্য।</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPrintableSlip(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium cursor-pointer"
              >
                {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>{language === 'bn' ? 'প্রিন্ট করুন' : 'Print'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
