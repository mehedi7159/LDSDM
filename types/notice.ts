/**
 * Notice & Communication Domain Types
 */

export type NoticeCategory = 'general' | 'academic' | 'exam' | 'holiday' | 'fee' | 'diary' | 'urgent' | 'event' | 'cancellation';
export type NoticePriority = 'normal' | 'important' | 'urgent';
export type NoticeTarget = 'all' | 'students' | 'teachers' | 'guardians' | 'class';

export interface NoticeItem {
  id: string;
  title: string;
  content: string;
  category: NoticeCategory;
  priority: NoticePriority;
  target: NoticeTarget;
  targetClass?: string;
  isPinned?: boolean;
  isActive?: boolean;
  showMarquee?: boolean;
  showAlertBanner?: boolean;
  authorName?: string;
  authorEmail?: string;
  authorRole?: string;
  date?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  attachmentUrl?: string;
}
