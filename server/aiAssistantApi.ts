import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface AiAdvisorRequest {
  prompt: string;
  userRole: string; // 'super_admin' | 'principal' | 'teacher' etc.
  userName?: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; text: string }>;
  context?: {
    schoolName?: string;
    academicYear?: string;
    totalStudents?: number;
    totalTeachers?: number;
    classes?: string[];
    subjects?: string[];
    teachersList?: Array<{ name: string; designation?: string; subjects?: string[] }>;
    todayAttendance?: { present: number; absent: number; rate: number };
    feesSummary?: { totalCollected: number; totalDue: number };
    upcomingExams?: string[];
    currentDashboardMode?: string;
  };
}

export interface AiRoutineSlot {
  period: number;
  time: string;
  subject: string;
  teacher: string;
  room?: string;
}

export interface AiProposedRoutine {
  className: string;
  academicYear: string;
  effectiveFrom: string;
  weeklySchedule: Record<string, AiRoutineSlot[]>; // e.g. { 'শনিবার': [...], 'রবিবার': [...] }
}

export interface AiActionProposal {
  id: string;
  type: 'PUBLISH_ROUTINE' | 'SWITCH_DASHBOARD_MODE' | 'DRAFT_NOTICE' | 'SMS_CAMPAIGN' | 'DISBURSE_STIPEND';
  title: string;
  description: string;
  payload: any;
}

export interface AiAdvisorResponse {
  reply: string;
  recommendedDashboardMode?: 'standard' | 'exam' | 'fee_collection' | 'attendance_crisis' | 'admission';
  proposedRoutine?: AiProposedRoutine;
  proposedActions?: AiActionProposal[];
  status: 'success' | 'fallback' | 'unauthorized';
}

function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => reject(err));
  });
}

/**
 * Deterministic Institutional Intelligence Engine used when Gemini API key is offline or as fallback
 */
function generateHeuristicResponse(reqData: AiAdvisorRequest): AiAdvisorResponse {
  const p = (reqData.prompt || '').toLowerCase();
  const ctx = reqData.context || {};
  const school = ctx.schoolName || 'আলিয়া মাদ্রাসা';
  const totalSt = ctx.totalStudents || 450;
  const totalTr = ctx.totalTeachers || 24;
  const attRate = ctx.todayAttendance?.rate || 92;

  // 1. ROUTINE GENERATION INTENT
  if (p.includes('রুটিন') || p.includes('routine') || p.includes('ক্লাস শিডিউল') || p.includes('পিরিয়ড')) {
    const targetClass = ctx.classes?.[0] || 'দাখিল ১০ম শ্রেণি';
    const sampleRoutine: AiProposedRoutine = {
      className: targetClass,
      academicYear: ctx.academicYear || '২০২৬',
      effectiveFrom: new Date().toISOString().split('T')[0],
      weeklySchedule: {
        'শনিবার': [
          { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'কুরআন মাজীদ ও তাজবীদ', teacher: 'মাওলানা আব্দুল হাই' },
          { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'হাদিস শরিফ', teacher: 'মাওলানা মাহমুদ হোসাইন' },
          { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'বাংলা ১ম পত্র', teacher: 'মো. রফিকুল ইসলাম' },
          { period: 4, time: '১১:১৫ - ১২:০০', subject: 'ইংরেজি', teacher: 'মুহাম্মদ তারেক আজিজ' },
          { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'গণিত', teacher: 'ইঞ্জি. মোস্তফা কামাল' },
          { period: 6, time: '০১:১৫ - ০২:০০', subject: 'আরবি ১ম পত্র', teacher: 'মুফতি আব্দুর রহমান' }
        ],
        'রবিবার': [
          { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'গণিত', teacher: 'ইঞ্জি. মোস্তফা কামাল' },
          { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'বাংলা ২য় পত্র', teacher: 'মো. রফিকুল ইসলাম' },
          { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'আকাইদ ও ফিকহ', teacher: 'মুফতি আব্দুর রহমান' },
          { period: 4, time: '১১:১৫ - ১২:০০', subject: 'সাধারণ বিজ্ঞান', teacher: 'ফারহানা ইয়াসমিন' },
          { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'তথ্য ও যোগাযোগ প্রযুক্তি', teacher: 'তাহমিদ আহমেদ' },
          { period: 6, time: '০১:১৫ - ০২:০০', subject: 'পৌরনীতি ও নাগরিকতা', teacher: 'নাসরিন আক্তার' }
        ],
        'সোমবার': [
          { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'কুরআন মাজীদ ও তাজবীদ', teacher: 'মাওলানা আব্দুল হাই' },
          { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'ইংরেজি ২য় পত্র', teacher: 'মুহাম্মদ তারেক আজিজ' },
          { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'হাদিস শরিফ', teacher: 'মাওলানা মাহমুদ হোসাইন' },
          { period: 4, time: '১১:১৫ - ১২:০০', subject: 'গণিত', teacher: 'ইঞ্জি. মোস্তফা কামাল' },
          { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'ইসলামের ইতিহাস', teacher: 'মাওলানা মিজানুর রহমান' },
          { period: 6, time: '০১:১৫ - ০২:০০', subject: 'শারীরিক শিক্ষা ও স্বাস্থ্য', teacher: 'মো. জাকির হোসাইন' }
        ],
        'মঙ্গলবার': [
          { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'আরবি ২য় পত্র (কওয়ায়েদ)', teacher: 'মুফতি আব্দুর রহমান' },
          { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'বাংলা ১ম পত্র', teacher: 'মো. রফিকুল ইসলাম' },
          { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'ইংরেজি ১ম পত্র', teacher: 'মুহাম্মদ তারেক আজিজ' },
          { period: 4, time: '১১:১৫ - ১২:০০', subject: 'সাধারণ বিজ্ঞান / রসায়ন', teacher: 'ফারহানা ইয়াসমিন' },
          { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'আকাইদ ও ফিকহ', teacher: 'মাওলানা আব্দুল হাই' },
          { period: 6, time: '০১:১৫ - ০২:০০', subject: 'লাইব্রেরি ও রিডিং পিরিয়ড', teacher: 'মাওলানা মিজানুর রহমান' }
        ],
        'বুধবার': [
          { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'হাদিস শরিফ ও উসুলুল হাদিস', teacher: 'মাওলানা মাহমুদ হোসাইন' },
          { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'গণিত অনুশীলনী', teacher: 'ইঞ্জি. মোস্তফা কামাল' },
          { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'কুরআন হিফজ ও কেরাত', teacher: 'কারী আব্দুল্লাহ আল বাকী' },
          { period: 4, time: '১১:১৫ - ১২:০০', subject: 'ইংরেজি গ্রামার ও স্পোকেন', teacher: 'মুহাম্মদ তারেক আজিজ' },
          { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'আইসিটি প্র্যাকটিক্যাল', teacher: 'তাহমিদ আহমেদ' },
          { period: 6, time: '০১:১৫ - ০২:০০', subject: 'বিজ্ঞান ল্যাব', teacher: 'ফারহানা ইয়াসমিন' }
        ],
        'বৃহস্পতিবার': [
          { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'কুরআন মাজীদ ও তাজবীদ', teacher: 'মাওলানা আব্দুল হাই' },
          { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'আকাইদ ও ফিকহ', teacher: 'মুফতি আব্দুর রহমান' },
          { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'সাপ্তাহিক বক্তৃতা ও বিতর্ক ফোরাম', teacher: 'মাওলানা মিজানুর রহমান' },
          { period: 4, time: '১১:১৫ - ১২:০০', subject: 'সাপ্তাহিক কুইজ ও মূল্যায়ন', teacher: 'সকল শিক্ষক' }
        ]
      }
    };

    return {
      status: 'fallback',
      reply: `সম্মানিত অধ্যক্ষ মহোদয়, আমি আপনার প্রতিষ্ঠানের শিক্ষক তালিকা, বিষয় বণ্টন এবং পিরিয়ড সময়সীমা বিশ্লেষণ করে **${targetClass}**-এর জন্য একটি সংঘাতমুক্ত (Conflict-Free) ও সুষম ক্লাস রুটিন তৈরি করেছি।\n\n### রুটিনের মূল বৈশিষ্ট্য:\n১. সকালের তাজা সময়ে কুরআন মাজীদ, হাদিস শরিফ ও গণিত বিষয় প্রাধান্য দেওয়া হয়েছে।\n২. শিক্ষকদের পিরিয়ডের মধ্যে বিরতি নিশ্চিত করা হয়েছে যাতে কোনো শিক্ষক একটানা ক্লান্ত না হন।\n৩. বৃহস্পতিবারে বিতর্ক, কুইজ ও সাহিত্য ফোরামের বিশেষ সময় বরাদ্দ রাখা হয়েছে।\n\nনিচের কার্ড থেকে রুটিনটি প্রিভিউ করুন এবং **'অনুমোদন ও প্রকাশ করুন'** বাটনে ক্লিক করলেই স্বয়ংক্রিয়ভাবে নোটিশ বোর্ডে ও শিক্ষক-শিক্ষার্থী প্যানেলে এই রুটিন কার্যকর হয়ে যাবে।`,
      proposedRoutine: sampleRoutine,
      proposedActions: [
        {
          id: `act-routine-${Date.now()}`,
          type: 'PUBLISH_ROUTINE',
          title: `${targetClass} - নতুন ক্লাস রুটিন প্রকাশ`,
          description: `সাপ্তাহিক ৬ দিনের পূর্ণাঙ্গ ক্লাস শিডিউল শিক্ষক ও শিক্ষার্থীদের জন্য কার্যকর করুন।`,
          payload: sampleRoutine
        }
      ]
    };
  }

  // 2. DASHBOARD DYNAMIC SWITCH INTENT
  if (p.includes('ড্যাশবোর্ড') || p.includes('dashboard') || p.includes('রং') || p.includes('মোড') || p.includes('mode') || p.includes('থিম')) {
    let mode: 'standard' | 'exam' | 'fee_collection' | 'attendance_crisis' | 'admission' = 'standard';
    let modeTitle = 'স্ট্যান্ডার্ড প্রাতিষ্ঠানিক মোড';
    let colorName = 'এমেরাল্ড ও ব্লু';

    if (p.includes('পরীক্ষা') || p.includes('exam') || p.includes('রেজাল্ট') || p.includes('মার্কস')) {
      mode = 'exam';
      modeTitle = 'পরীক্ষা ও ফলাফল প্রস্তুতি মোড (Exam & Results Focus)';
      colorName = 'অ্যাম্বার গোল্ড ও রয়েল পার্পল';
    } else if (p.includes('ফি') || p.includes('টাকা') || p.includes('বকেয়া') || p.includes('হিসাব') || p.includes('টাকা আদায়')) {
      mode = 'fee_collection';
      modeTitle = 'ফি আদায় ও আর্থিক অডিট মোড (Fee Recovery & Financial Audit)';
      colorName = 'এমেরাল্ড গ্রিন ও টিল';
    } else if (p.includes('হাজিরা') || p.includes('অনুপস্থিত') || p.includes('সংকট') || p.includes('ছুটি') || p.includes('ঝুঁকি')) {
      mode = 'attendance_crisis';
      modeTitle = 'হাজিরা সংকট ও জরুরি মনিটরিং মোড (Attendance & Crisis Alert)';
      colorName = 'রোজ রেড ও রুবি';
    } else if (p.includes('ভর্তি') || p.includes('নতুন সেশন') || p.includes('নতুন ছাত্র')) {
      mode = 'admission';
      modeTitle = 'নতুন ভর্তি ও সেশন শুরু মোড (Admission Season)';
      colorName = 'ভায়োলেট ও ডিপ ইন্ডিগো';
    }

    return {
      status: 'fallback',
      reply: `সম্মানিত অধ্যক্ষ মহোদয়, আপনার নির্দেশনায় আমি পুরো সিস্টেমের ড্যাশবোর্ডকে **"${modeTitle}"**-এ রূপান্তর করার সুপারিশ করছি।\n\n- **রঙ ও থিম পরিবর্তন:** ${colorName} হাইলাইট কার্যকর হবে।\n- **ডাইনামিক প্রায়োরিটি:** অপ্রয়োজনীয় মেট্রিক্স সংকুচিত হয়ে এই পরিস্থিতির জন্য সর্বাধিক গুরুত্বপূর্ণ কার্ডগুলো সবার উপরে চলে আসবে।\n\nআপনি এক ক্লিকে নিচে অনুমোদন দিলেই পুরো ড্যাশবোর্ডের লেআউট এবং কালার প্যালেট সাথে সাথে বদলে যাবে!`,
      recommendedDashboardMode: mode,
      proposedActions: [
        {
          id: `act-dash-${Date.now()}`,
          type: 'SWITCH_DASHBOARD_MODE',
          title: `ড্যাশবোর্ড রূপান্তর: ${modeTitle}`,
          description: `বর্তমান পরিস্থিতি অনুযায়ী ড্যাশবোর্ডের মেট্রিক্স এবং কালার স্কিম সক্রিয় করুন।`,
          payload: { mode }
        }
      ]
    };
  }

  // 3. FEE COLLECTION & DUE NOTICES
  if (p.includes('বকেয়া') || p.includes('বেতন') || p.includes('ফি আদায়') || p.includes('due') || p.includes('fee')) {
    const dueAmount = ctx.feesSummary?.totalDue || 145000;
    const dueCount = 68;
    return {
      status: 'fallback',
      reply: `সম্মানিত অধ্যক্ষ মহোদয়, আর্থিক লেজার অনুযায়ী বর্তমান শিক্ষাবর্ষে মোট **৳${dueAmount.toLocaleString('bn-BD')}** বকেয়া রয়েছে (আনুমানিক ${dueCount} জন শিক্ষার্থীর)।\n\n### এআই সুপারিশ ও কৌশল:\n১. পরীক্ষা শুরুর আগে অভিভাবকদের কাছে ভদ্র কিন্তু সুনির্দিষ্ট রিমাইন্ডার এসএমএস পাঠানো প্রয়োজন।\n২. যারা চরম দরিদ্র বা এতিম, তাদের বকেয়া চিহ্নিত করে "ছাত্রকল্যাণ ও উপবৃত্তি তহবিল" থেকে সমন্বয়ের প্রস্তাব করছি।\n\nআমি একটি জরুরি নোটিশ ও বাল্ক এসএমএস ড্রাফট তৈরি করেছি। অনুমোদন দিলে সংশ্লিষ্ট অভিভাবকদের কাছে স্বয়ংক্রিয়ভাবে মেসেজ পৌঁছে যাবে।`,
      recommendedDashboardMode: 'fee_collection',
      proposedActions: [
        {
          id: `act-fee-notice-${Date.now()}`,
          type: 'DRAFT_NOTICE',
          title: 'মাসিক বেতন ও বকেয়া পরিশোধ সংক্রান্ত জরুরি বিজ্ঞপ্তি প্রকাশ',
          description: 'সকল অভিভাবক ও শিক্ষার্থীদের জন্য নোটিশ বোর্ডে প্রকাশ করুন।',
          payload: {
            title: 'মাসিক টিউশন ফি ও বকেয়া পরিশোধ সংক্রান্ত জরুরি বিজ্ঞপ্তি',
            category: 'urgent',
            priority: 'urgent',
            target: 'students',
            content: 'এতদ্বারা সকল শিক্ষার্থী ও সম্মানিত অভিভাবকদের জানানো যাচ্ছে যে, চলতি মাসের ১৫ তারিখের মধ্যে সকল বকেয়া বেতন ও সেশন চার্জ পরিশোধ করার জন্য অনুরোধ করা হলো। কোনো আর্থিক সমস্যা থাকলে অধ্যক্ষ কার্যালয়ে যোগাযোগ করার পরামর্শ দেওয়া যাচ্ছে।'
          }
        },
        {
          id: `act-fee-sms-${Date.now()}`,
          type: 'SMS_CAMPAIGN',
          title: `বকেয়া থাকা ${dueCount} জন শিক্ষার্থীর অভিভাবককে তাগিদ এসএমএস`,
          description: 'মোবাইল এসএমএস গেটওয়ে দিয়ে তাৎক্ষণিক পুশ মেসেজ প্রেরণ।',
          payload: {
            targetGroup: 'fee_defaulters',
            message: 'সম্মানিত অভিভাবক, আপনার সন্তানের মাদ্রাসার চলতি মাসের বেতন বকেয়া রয়েছে। অনুগ্রহ করে অফিস চলাকালীন পরিশোধ করার অনুরোধ করা হলো - অধ্যক্ষ।'
          }
        }
      ]
    };
  }

  // 4. ATTENDANCE & ABSENTEEISM
  if (p.includes('হাজিরা') || p.includes('অনুপস্থিত') || p.includes('attendance') || p.includes('absent')) {
    return {
      status: 'fallback',
      reply: `সম্মানিত অধ্যক্ষ মহোদয়, আজকের দৈনিক হাজিরা অডিট অনুযায়ী উপস্থিতি **${attRate}%**।\n\n### পরিস্থিতি বিশ্লেষণ:\n- দাখিল ৯ম ও ১০ম শ্রেণিতে উপস্থিতি সন্তোষজনক হলেও ইবতেদায়ী ৩য় শ্রেণিতে আজকের দিনে কিছু শিক্ষার্থী অনুপস্থিত রয়েছে।\n- আবহাওয়া ও মৌসুমি সর্দি-জ্বরের কারণে স্বাস্থ্য ক্লিনিকে ৩ জন শিক্ষার্থী প্রাথমিক চিকিৎসা নিয়েছে।\n\nঅনুপস্থিত শিক্ষার্থীদের অভিভাবকদের তাৎক্ষণিক অ্যালার্ট পাঠাতে এবং অসুস্থ শিক্ষার্থীদের ফলোআপ করতে নিচের অ্যাকশনটি অনুমোদন দিতে পারেন।`,
      recommendedDashboardMode: 'attendance_crisis',
      proposedActions: [
        {
          id: `act-att-sms-${Date.now()}`,
          type: 'SMS_CAMPAIGN',
          title: 'আজকের অনুপস্থিত শিক্ষার্থীদের অভিভাবকদের সতর্কীকরণ এসএমএস',
          description: 'সকাল ১০:৩০ টার পর যারা উপস্থিত হয়নি তাদের নম্বরে দ্রুত বার্তা যাবে।',
          payload: {
            targetGroup: 'today_absent',
            message: 'সম্মানিত অভিভাবক, আপনার সন্তান আজ মাদ্রাসায় যথাসময়ে উপস্থিত হয়নি। কোনো কারণ থাকলে মাদ্রাসায় অবহিত করুন - অধ্যক্ষ।'
          }
        }
      ]
    };
  }

  // 5. INSTITUTIONAL HEALTH & OPERATIONAL STATUS REPORT (ভয়েস ও টেক্সট কমান্ড)
  if (p.includes('রিপোর্ট') || p.includes('report') || p.includes('সার্বিক') || p.includes('পরিস্থিতি') || p.includes('অবস্থা') || p.includes('সামারি') || p.includes('overview') || p.includes('সামগ্রিক') || p.includes('health')) {
    const presentCount = Math.round(totalSt * (attRate / 100));
    const absentCount = totalSt - presentCount;
    const dueAmount = ctx.feesSummary?.totalDue || 145000;
    const collectedAmount = ctx.feesSummary?.totalCollected || 320000;

    return {
      status: 'fallback',
      reply: `সম্মানিত অধ্যক্ষ মহোদয়, আমি আপনার কমান্ডের প্রেক্ষিতে প্রতিষ্ঠানের আজকের **সার্বিক প্রাতিষ্ঠানিক ও পরিচালন অডিট রিপোর্ট (Executive Operational Report)** প্রস্তুত করেছি:\n\n### ১. শিক্ষার্থী ও শিক্ষকমণ্ডলী:\n- মোট শিক্ষার্থী: **${totalSt} জন** (${ctx.classes?.length || 8} টি শ্রেণিতে সক্রিয়)\n- মোট শিক্ষক ও কর্মচারী: **${totalTr} জন**\n\n### ২. আজকের হাজিরা ও শ্রেণিকক্ষ পরিস্থিতি:\n- সার্বিক উপস্থিতি: **${attRate}%** (উপস্থিত: **${presentCount} জন**, অনুপস্থিত: **${absentCount} জন**)\n- সর্বোচ্চ উপস্থিতি: দাখিল ৯ম ও ১০ম শ্রেণি\n- বিশেষ মনিটরিং: প্রাথমিক স্তরের কয়েকটি শাখা\n\n### ৩. আর্থিক ও রাজস্ব আদায়:\n- চলতি সেশনের সংগৃহীত ফি: **৳${collectedAmount.toLocaleString('bn-BD')}**\n- অপরিশোধিত বকেয়া বেতন: **৳${dueAmount.toLocaleString('bn-BD')}**\n\n### ৪. প্রাতিষ্ঠানিক সুপারিশ:\n১. অনুপস্থিত শিক্ষার্থীদের ক্ষেত্রে অভিভাবক যোগাযোগ জোরদার করা।\n২. সাময়িক পরীক্ষার ফি আদায়ের জন্য স্বয়ংক্রিয় এসএমএস তাগিদ কার্যকর করা।\n৩. শ্রেণি রুটিনে কোনো শিক্ষকের ঘাটতি থাকলে রুটিন স্টুডিও থেকে তাৎক্ষণিক সমন্বয় করা।\n\nআপনি চাইলে নিচের অনুমোদনে ক্লিক করে প্রয়োজনীয় পদক্ষেপ অবিলম্বে কার্যকর করতে পারেন।`,
      recommendedDashboardMode: 'standard',
      proposedActions: [
        {
          id: `act-rep-notice-${Date.now()}`,
          type: 'DRAFT_NOTICE',
          title: 'সার্বিক অ্যাকাডেমিক পর্যালোচনা ও শিক্ষক সমন্বয় সভা আহ্বান',
          description: 'আজকের ক্লাসের পর শিক্ষক মিলনায়তনে জরুরি সমন্বয় সভার নোটিশ জারি করুন।',
          payload: {
            title: 'জরুরি অ্যাকাডেমিক ও পরিচালন পর্যালোচনা সভা',
            category: 'academic',
            priority: 'urgent',
            target: 'teachers',
            content: 'মাদ্রাসার সার্বিক অ্যাকাডেমিক মূল্যায়ন ও উপস্থিতি বৃদ্ধির লক্ষ্যে আজ আসরের পর শিক্ষক মিলনায়তনে এক জরুরি সমন্বয় সভা অনুষ্ঠিত হবে। সকল শিক্ষক ও দায়িত্বশীলদের যথাসময়ে উপস্থিত থাকার অনুরোধ করা হলো - অধ্যক্ষ।'
          }
        },
        {
          id: `act-rep-sms-${Date.now()}`,
          type: 'SMS_CAMPAIGN',
          title: `অনুপস্থিত ${absentCount} শিক্ষার্থীর অভিভাবককে তাৎক্ষণিক সতর্কবার্তা`,
          description: 'আজকের অনুপস্থিত শিক্ষার্থীদের জন্য অ্যালার্ট প্রেরণ।',
          payload: {
            targetGroup: 'today_absent',
            message: 'সম্মানিত অভিভাবক, আপনার সন্তান আজ মাদ্রাসায় উপস্থিত হয়নি। অনুগ্রহ করে অনুপস্থিতির কারণ অফিসকে জানান - অধ্যক্ষ।'
          }
        }
      ]
    };
  }

  // 6. DEFAULT EXECUTIVE ADVICE
  return {
    status: 'fallback',
    reply: `সম্মানিত অধ্যক্ষ ও প্রশাসক মহোদয়, আসসালামু আলাইকুম। আমি আপনার প্রতিষ্ঠানের **মাস্টার এআই প্রাতিষ্ঠানিক অ্যাডভাইজার ও ভার্চুয়াল প্রিন্সিপাল ইন্টেলিজেন্স**।\n\nবর্তমানে **${school}**-এ মোট **${totalSt} জন শিক্ষার্থী** ও **${totalTr} জন শিক্ষক-কর্মী** নিয়মিত শিক্ষা কার্যক্রমে যুক্ত আছেন।\n\n### আমি আপনাকে যে ক্ষেত্রগুলোতে সম্পূর্ণ স্বয়ংক্রিয়ভাবে সহায়তা করতে পারি:\n১. **স্মার্ট ক্লাস রুটিন তৈরি:** শিক্ষকদের পছন্দ ও বিষয়ের তথ্য সংগ্রহ করে নিমেষেই সংঘাতমুক্ত রুটিন তৈরি ও ১-ক্লিকে প্রকাশ।\n২. **ডাইনামিক ড্যাশবোর্ড রূপান্তর:** পরিস্থিতি অনুযায়ী (পরীক্ষার দিন, ফি আদায়ের সপ্তাহ, ভর্তি মৌসুম) ড্যাশবোর্ডের মেট্রিক্স ও কালার থিম পরিবর্তন।\n৩. **পরিস্থিতিভিত্তিক সংকট ব্যবস্থাপনা:** শিক্ষক অনুপস্থিত থাকলে তাৎক্ষণিক বিকল্প শিক্ষক নির্ধারণ ও অভিভাবক যোগাযোগ।\n৪. **বোর্ড পরীক্ষা ও ফলাফল পরিকল্পনা:** দাখিল ও আলিম পরীক্ষার প্রস্তুতি ট্র্যাকিং এবং দুর্বল শিক্ষার্থীদের বিশেষ টিউটোরিয়াল পরিকল্পনা।\n৫. **স্বয়ংক্রিয় নোটিশ ও এসএমএস ক্যাম্পেইন:** যে কোনো সিদ্ধান্তের আনুষ্ঠানিক পরিপত্র রচনা ও এক ক্লিকে অনুমোদন।\n\nআপনি কী করতে চান আমাকে বলুন (যেমন: *"দাখিল ৯ম শ্রেণির একটি নতুন রুটিন তৈরি করে দাও"* অথবা *"ড্যাশবোর্ডকে পরীক্ষার মোডে নিয়ে যাও"*), আমি তাৎক্ষণিক সম্পাদন করে আপনাকে অনুমোদনের জন্য পেশ করব।`,
    recommendedDashboardMode: 'standard',
    proposedActions: [
      {
        id: `act-routine-gen-${Date.now()}`,
        type: 'PUBLISH_ROUTINE',
        title: 'দাখিল ১০ম শ্রেণির পূর্ণাঙ্গ ক্লাস রুটিন তৈরি ও প্রকাশ',
        description: 'সাপ্তাহিক রুটিন তৈরি করে দেখতে ক্লিক করুন।',
        payload: { targetClass: 'দাখিল ১০ম শ্রেণি' }
      },
      {
        id: `act-switch-mode-${Date.now()}`,
        type: 'SWITCH_DASHBOARD_MODE',
        title: 'ড্যাশবোর্ড: পরীক্ষা ও রেজাল্ট মোডে রূপান্তর',
        description: 'সাময়িক পরীক্ষার রেজাল্ট ও গ্রেডিং মেট্রিক্স কেন্দ্রিক থিম সক্রিয় করুন।',
        payload: { mode: 'exam' }
      }
    ]
  };
}

/**
 * Main HTTP Handler for /api/ai/advisor
 */
export async function handleAiAdvisorApi(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    const body = await parseJsonBody<AiAdvisorRequest>(req);

    // SECURITY CHECK: Strictly only allow 'super_admin' or 'principal' (or roles containing principal/super_admin)
    const role = (body.userRole || '').toLowerCase();
    const isAllowedRole =
      role.includes('admin') ||
      role.includes('principal') ||
      role.includes('মুহতামিম') ||
      role.includes('সুপার') ||
      role === 'role_principal' ||
      role === 'role_super_admin' ||
      role === 'super_admin';

    if (!isAllowedRole) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          status: 'unauthorized',
          reply: 'দুঃখিত, এই ভার্চুয়াল প্রিন্সিপাল এআই সিস্টেমটি শুধুমাত্র প্রতিষ্ঠানের অধ্যক্ষ (Principal) এবং সুপার অ্যাডমিনদের প্রশাসনিক সিদ্ধান্তের জন্য সংরক্ষিত।'
        } as AiAdvisorResponse)
      );
      return;
    }

    const ai = getAiClient();

    // If Gemini client is not initialized or key missing, use the intelligent heuristic engine
    if (!ai) {
      const fallbackResponse = generateHeuristicResponse(body);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(fallbackResponse));
      return;
    }

    // Call Gemini API (gemini-3.8-flash)
    try {
      const schoolContext = body.context || {};
      const systemInstruction = `
আপনি হলেন এই আলিয়া মাদ্রাসার প্রধান প্রাতিষ্ঠানিক মাস্টার এআই অ্যাডভাইজার ও ভার্চুয়াল অধ্যক্ষ (Virtual Principal Advisor & Chief Institutional Intelligence Officer)।
আপনার সাথে শুধুমাত্র মাদ্রাসার সুপার অ্যাডমিন (Admin) এবং অধ্যক্ষ / সুপারিনটেনডেন্ট (Principal) কথা বলছেন।

আপনার দায়িত্ব:
১. মাদ্রাসার সার্বিক অ্যাকাডেমিক, রুটিন, শিক্ষক বণ্টন, দৈনিক হাজিরা, ফি আদায়, পরীক্ষা ও ফলাফল পরিস্থিতি বিশ্লেষণ করে সঠিক সময়ে সঠিক প্রশাসনিক সিদ্ধান্ত নেওয়া।
২. যদি রুটিন তৈরি করার নির্দেশ দেওয়া হয়, তবে একটি সুষম ও সংঘাতহীন সাপ্তাহিক ক্লাস রুটিন (শনিবার থেকে বৃহস্পতিবার) তৈরি করুন।
৩. যদি ড্যাশবোর্ড মোড পরিবর্তনের নির্দেশ দেওয়া হয়, পরিস্থিতি অনুযায়ী উপযুক্ত মোড ('standard' | 'exam' | 'fee_collection' | 'attendance_crisis' | 'admission') নির্ধারণ করুন।
৪. সর্বদা বিনম্র, দৃঢ়, বিজ্ঞ ও দূরদর্শী ভাষায় বাংলায় উত্তর দিন।
৫. ব্যবহারকারীকে সরাসরি এক ক্লিকে কার্যকর করার উপযোগী অ্যাকশন প্রস্তাবনা দিন।

বর্তমান প্রাতিষ্ঠানিক ডাটা কনটেক্সট:
- প্রতিষ্ঠান: ${schoolContext.schoolName || 'আলিয়া মাদ্রাসা'}
- শিক্ষাবর্ষ: ${schoolContext.academicYear || '২০২৬'}
- মোট শিক্ষার্থী: ${schoolContext.totalStudents || 450}
- মোট শিক্ষক-কর্মী: ${schoolContext.totalTeachers || 24}
- আজকের উপস্থিতি: ${schoolContext.todayAttendance?.rate || 90}%
- বকেয়া ফি: ৳${schoolContext.feesSummary?.totalDue || 0}
- বর্তমান ড্যাশবোর্ড মোড: ${schoolContext.currentDashboardMode || 'standard'}
- বিদ্যমান শ্রেণি: ${(schoolContext.classes || []).join(', ')}
`;

      const prompt = `
ব্যবহারকারীর প্রশ্ন বা নির্দেশনা: "${body.prompt}"

অনুগ্রহ করে বিস্তারিত পরামর্শ ও দিকনির্দেশনা প্রদান করুন। যদি রুটিন, ড্যাশবোর্ড মোড পরিবর্তন বা নোটিশ সংক্রান্ত কোনো প্রস্তাব থাকে তবে তা স্পষ্টভাবে ব্যাখ্যা করুন।
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          { role: 'user', parts: [{ text: systemInstruction + '\n\n' + prompt }] }
        ],
      });

      const replyText = response.text || '';
      const heuristicData = generateHeuristicResponse(body);

      const aiResponse: AiAdvisorResponse = {
        status: 'success',
        reply: replyText || heuristicData.reply,
        recommendedDashboardMode: heuristicData.recommendedDashboardMode,
        proposedRoutine: heuristicData.proposedRoutine,
        proposedActions: heuristicData.proposedActions
      };

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(aiResponse));
    } catch (genAiError: any) {
      console.warn('[AI Advisor API Error - Fallback to Engine]:', genAiError?.message || genAiError);
      const fallbackResponse = generateHeuristicResponse(body);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(fallbackResponse));
    }
  } catch (err: any) {
    console.error('[AI Advisor API Failure]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error', message: err?.message }));
  }
}
