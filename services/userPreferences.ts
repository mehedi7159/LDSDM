// Personal display + notification preferences for the Settings page
// (Phase 1). These are per-device preferences stored in localStorage only —
// they never touch institutional/cloud data.

export type TextSizeId = 'small' | 'medium' | 'large';
export type CornerStyleId = 'rounded' | 'soft' | 'crisp';

export interface NotificationPrefs {
  push: boolean;
  messages: boolean;
  promos: boolean;
  sound: boolean;
  vibration: boolean;
}

export interface UserPrefs {
  textSize: TextSizeId;
  corner: CornerStyleId;
  notifications: NotificationPrefs;
}

export const DEFAULT_PREFS: UserPrefs = {
  textSize: 'medium',
  corner: 'rounded',
  notifications: { push: true, messages: true, promos: false, sound: true, vibration: true }
};

const TEXT_SIZE_KEY = 'ldsdm_text_size';
const CORNER_KEY = 'ldsdm_corner_style';
const NOTIF_KEY = 'ldsdm_notification_prefs';

// Page-scope text preview factor (applied as zoom on the Settings page
// wrapper). Kept modest so layouts never break.
export const TEXT_SIZE_ZOOM: Record<TextSizeId, number> = {
  small: 0.92,
  medium: 1,
  large: 1.12
};

// Corner radius consumed by the Settings page via var(--ldsdm-radius).
export const CORNER_VARS: Record<CornerStyleId, string> = {
  rounded: '1rem',
  soft: '1.75rem',
  crisp: '0.375rem'
};

function readTextSize(): TextSizeId {
  const v = localStorage.getItem(TEXT_SIZE_KEY);
  return v === 'small' || v === 'medium' || v === 'large' ? v : DEFAULT_PREFS.textSize;
}

function readCorner(): CornerStyleId {
  const v = localStorage.getItem(CORNER_KEY);
  return v === 'rounded' || v === 'soft' || v === 'crisp' ? v : DEFAULT_PREFS.corner;
}

function readNotifications(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return DEFAULT_PREFS.notifications;
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      push: typeof parsed.push === 'boolean' ? parsed.push : DEFAULT_PREFS.notifications.push,
      messages: typeof parsed.messages === 'boolean' ? parsed.messages : DEFAULT_PREFS.notifications.messages,
      promos: typeof parsed.promos === 'boolean' ? parsed.promos : DEFAULT_PREFS.notifications.promos,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_PREFS.notifications.sound,
      vibration: typeof parsed.vibration === 'boolean' ? parsed.vibration : DEFAULT_PREFS.notifications.vibration
    };
  } catch {
    return DEFAULT_PREFS.notifications;
  }
}

export function loadUserPrefs(): UserPrefs {
  return { textSize: readTextSize(), corner: readCorner(), notifications: readNotifications() };
}

export function saveUserPrefs(prefs: UserPrefs): void {
  try {
    localStorage.setItem(TEXT_SIZE_KEY, prefs.textSize);
    localStorage.setItem(CORNER_KEY, prefs.corner);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs.notifications));
  } catch {
    // Private-mode storage failure: preferences stay in memory only.
  }
}

// Live-preview plumbing: CSS variables + data attributes on the document
// root. The Settings page consumes var(--ldsdm-radius); future pages can
// consume the same variables.
export function applyPrefPreview(prefs: Pick<UserPrefs, 'textSize' | 'corner'>): void {
  const root = document.documentElement;
  root.style.setProperty('--ldsdm-radius', CORNER_VARS[prefs.corner]);
  root.style.setProperty('--ldsdm-text-size', String(TEXT_SIZE_ZOOM[prefs.textSize]));
  root.setAttribute('data-text-size', prefs.textSize);
  root.setAttribute('data-corner-style', prefs.corner);
}
