import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AccentThemeId = 'indigo' | 'blue' | 'emerald' | 'amber' | 'teal';

export interface AccentThemeOption {
  id: AccentThemeId;
  nameEn: string;
  nameBn: string;
  primary: string;
  hover: string;
  light: string;
  ring: string;
}

export const ACCENT_THEMES: AccentThemeOption[] = [
  {
    id: 'indigo',
    nameEn: 'Linear Indigo',
    nameBn: 'লিনিয়ার ইন্ডিগো',
    primary: '#4f46e5',
    hover: '#4338ca',
    light: '#eef2ff',
    ring: '#6366f1'
  },
  {
    id: 'blue',
    nameEn: 'Stripe Blue',
    nameBn: 'স্ট্রাইপ ব্লু',
    primary: '#2563eb',
    hover: '#1d4ed8',
    light: '#eff6ff',
    ring: '#3b82f6'
  },
  {
    id: 'emerald',
    nameEn: 'Schola Emerald',
    nameBn: 'স্কোলা এমারেল্ড',
    primary: '#059669',
    hover: '#047857',
    light: '#ecfdf5',
    ring: '#10b981'
  },
  {
    id: 'amber',
    nameEn: 'Warm Amber',
    nameBn: 'ওয়ার্ম অ্যাম্বার',
    primary: '#d97706',
    hover: '#b45309',
    light: '#fffbeb',
    ring: '#f59e0b'
  },
  {
    id: 'teal',
    nameEn: 'Nordic Teal',
    nameBn: 'নর্ডিক টিল',
    primary: '#0d9488',
    hover: '#0f766e',
    light: '#f0fdfa',
    ring: '#14b8a6'
  }
];

export interface ToastMessage {
  id: string;
  type: 'success' | 'delete' | 'restore' | 'info' | 'error';
  title?: string;
  message: string;
  timestamp: number;
  duration?: number;
  onUndo?: () => void;
}

export interface ToastInput {
  type?: 'success' | 'delete' | 'restore' | 'info' | 'error';
  title?: string;
  message: string;
  duration?: number;
  onUndo?: () => void;
}

interface ThemeContextType {
  accentTheme: AccentThemeId;
  currentThemeConfig: AccentThemeOption;
  setAccentTheme: (id: AccentThemeId) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;
  toasts: ToastMessage[];
  showToast: (toast: ToastInput) => void;
  showSuccess: (message: string, title?: string) => void;
  showDeleted: (message: string, onUndo?: () => void) => void;
  showRestored: (message: string) => void;
  showError: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accentTheme, setAccentThemeState] = useState<AccentThemeId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ldsdm_accent_theme') as AccentThemeId;
      if (ACCENT_THEMES.some(t => t.id === saved)) return saved;
    }
    return 'indigo';
  });

  // Permanently locked to light mode
  const darkMode = false;

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Apply accent theme to document root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', accentTheme);
    const themeObj = ACCENT_THEMES.find(t => t.id === accentTheme) || ACCENT_THEMES[0];
    root.style.setProperty('--color-brand', themeObj.primary);
    root.style.setProperty('--color-brand-hover', themeObj.hover);
    root.style.setProperty('--color-brand-light', themeObj.light);
    root.style.setProperty('--color-brand-ring', themeObj.ring);
    localStorage.setItem('ldsdm_accent_theme', accentTheme);
  }, [accentTheme]);

  // Permanently remove dark mode class from document root and clean storage
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    try {
      localStorage.removeItem('ldsdm_dark_mode');
    } catch {
      // ignore
    }
  }, []);

  const setAccentTheme = useCallback((id: AccentThemeId) => {
    setAccentThemeState(id);
  }, []);

  const setDarkMode = useCallback((_dark: boolean) => {
    // Night mode permanently disabled
  }, []);

  const toggleDarkMode = useCallback(() => {
    // Night mode permanently disabled
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const duration = input.duration || 4500;
    const newToast: ToastMessage = {
      id,
      type: input.type || 'success',
      title: input.title,
      message: input.message,
      timestamp: Date.now(),
      duration,
      onUndo: input.onUndo
    };

    setToasts(prev => [...prev.slice(-4), newToast]); // Keep up to 5 toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const showSuccess = useCallback((message: string, title?: string) => {
    showToast({ type: 'success', title, message });
  }, [showToast]);

  const showDeleted = useCallback((message: string, onUndo?: () => void) => {
    showToast({ type: 'delete', message, onUndo });
  }, [showToast]);

  const showRestored = useCallback((message: string) => {
    showToast({ type: 'restore', message });
  }, [showToast]);

  const showError = useCallback((message: string, title?: string) => {
    showToast({ type: 'error', title, message });
  }, [showToast]);

  const currentThemeConfig = ACCENT_THEMES.find(t => t.id === accentTheme) || ACCENT_THEMES[0];

  return (
    <ThemeContext.Provider
      value={{
        accentTheme,
        currentThemeConfig,
        setAccentTheme,
        darkMode,
        setDarkMode,
        toggleDarkMode,
        toasts,
        showToast,
        showSuccess,
        showDeleted,
        showRestored,
        showError,
        removeToast
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
