import React from 'react';
import { WifiOff, CheckCircle } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9998] flex items-center gap-2.5 rounded-2xl bg-amber-600/95 text-white px-3.5 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md border border-amber-400/40 animate-pulse pointer-events-auto">
      <WifiOff size={16} className="shrink-0 text-amber-100" />
      <div>
        <div className="leading-tight">অফলাইন মোড চালু আছে</div>
        <div className="text-[10px] text-amber-100/90 font-normal">ক্যাশ করা ডাটা ও সার্ভিস ওয়ার্কার দিয়ে সিস্টেম সচল রয়েছে</div>
      </div>
    </div>
  );
};
