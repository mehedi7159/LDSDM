import React from 'react';
import { RecycleBinPanel } from './RecycleBinPanel';

// Dedicated Recycle Bin page — the same panel as the Data Security hub's
// modal, but directly reachable from the menu (desktop sidebar + mobile
// More sheet), admin-only like the backup hub.
export const RecycleBinPage: React.FC = () => {
  return (
 <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800">
      <RecycleBinPanel />
    </div>
  );
};
