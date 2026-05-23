import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'oled';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  switchThemeWithAnimation: (newTheme: Theme) => void;
  uiScale: number;
  setUiScale: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'bonnext:theme';
const UI_SCALE_STORAGE_KEY = 'bonnext:ui-scale';
const UI_SCALE_MIN = 0.5;
const UI_SCALE_MAX = 2.0;
const UI_SCALE_DEFAULT = 1.0;

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'oled') return stored;
  } catch {}
  return 'dark';
}

function getInitialUiScale(): number {
  try {
    const stored = localStorage.getItem(UI_SCALE_STORAGE_KEY);
    if (stored !== null) {
      const val = parseFloat(stored);
      if (!isNaN(val) && val >= UI_SCALE_MIN && val <= UI_SCALE_MAX) return val;
    }
  } catch {}
  return UI_SCALE_DEFAULT;
}

const THEME_CLASS_MAP: Record<Theme, string> = {
  dark: 'theme-dark',
  light: 'theme-light',
  oled: 'theme-oled',
};

const THEME_CYCLE: Theme[] = ['dark', 'light', 'oled'];

function applyUiScale(scale: number) {
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  document.documentElement.style.fontSize = `${scale * 16}px`;
}

function createThemeSwitcher(setThemeState: React.Dispatch<React.SetStateAction<Theme>>) {
  return function switchThemeWithAnimation(newTheme: Theme) {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    root.classList.remove('theme-dark', 'theme-light', 'theme-oled');
    root.classList.add(THEME_CLASS_MAP[newTheme]);
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {}
    setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 350);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [uiScale, setUiScaleState] = useState<number>(getInitialUiScale);

  const applyThemeClass = useCallback((t: Theme) => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-oled');
    root.classList.add(THEME_CLASS_MAP[t]);
  }, []);

  useEffect(() => {
    applyThemeClass(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme, applyThemeClass]);

  useEffect(() => {
    applyUiScale(uiScale);
    try {
      localStorage.setItem(UI_SCALE_STORAGE_KEY, String(uiScale));
    } catch {}
  }, [uiScale]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const idx = THEME_CYCLE.indexOf(prev);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    });
  }, []);

  const switchWithAnimation = useCallback(
    (newTheme: Theme) => {
      createThemeSwitcher(setThemeState)(newTheme);
    },
    []
  );

  const setUiScale = useCallback((scale: number) => {
    const clamped = Math.round(Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, scale)) * 100) / 100;
    setUiScaleState(clamped);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, switchThemeWithAnimation: switchWithAnimation, uiScale, setUiScale }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export { UI_SCALE_MIN, UI_SCALE_MAX };
