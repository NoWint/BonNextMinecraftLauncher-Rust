import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type Theme = 'dark' | 'light' | 'oled';
export type AnimationSpeed = 'fast' | 'normal' | 'smooth' | 'custom';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  switchThemeWithAnimation: (newTheme: Theme) => void;
  uiScale: number;
  setUiScale: (scale: number) => void;
  animationSpeed: AnimationSpeed;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  animationDuration: number;
  setAnimationDuration: (duration: number) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'bonnext:theme';
const UI_SCALE_STORAGE_KEY = 'bonnext:ui-scale';
const ANIM_SPEED_STORAGE_KEY = 'bonnext:animation-speed';
const ANIM_DURATION_STORAGE_KEY = 'bonnext:animation-duration';
const UI_SCALE_MIN = 0.5;
const UI_SCALE_MAX = 2.0;
const UI_SCALE_DEFAULT = 1.0;

const ANIM_SPEED_MAP: Record<AnimationSpeed, number> = {
  fast: 0.5,
  normal: 1.0,
  smooth: 1.8,
  custom: 1.0,
};

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

function getInitialAnimationSpeed(): AnimationSpeed {
  try {
    const stored = localStorage.getItem(ANIM_SPEED_STORAGE_KEY);
    if (stored === 'fast' || stored === 'normal' || stored === 'smooth' || stored === 'custom') return stored;
  } catch {}
  return 'normal';
}

function getInitialAnimationDuration(): number {
  try {
    const stored = localStorage.getItem(ANIM_DURATION_STORAGE_KEY);
    if (stored !== null) {
      const val = parseFloat(stored);
      if (!isNaN(val) && val >= 0.2 && val <= 5.0) return val;
    }
  } catch {}
  return 1.0;
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
  const [animationSpeed, setAnimationSpeedState] = useState<AnimationSpeed>(getInitialAnimationSpeed);
  const [animationDuration, setAnimationDurationState] = useState<number>(getInitialAnimationDuration);

  const applyAnimationSpeed = useCallback((speed: AnimationSpeed, customDuration: number) => {
    const root = document.documentElement;
    const duration = speed === 'custom' ? customDuration : ANIM_SPEED_MAP[speed];
    root.style.setProperty('--anim-speed', String(duration));
  }, []);

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

  useEffect(() => {
    applyAnimationSpeed(animationSpeed, animationDuration);
    try {
      localStorage.setItem(ANIM_SPEED_STORAGE_KEY, animationSpeed);
      localStorage.setItem(ANIM_DURATION_STORAGE_KEY, String(animationDuration));
    } catch {}
  }, [animationSpeed, animationDuration, applyAnimationSpeed]);

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

  const setAnimationSpeed = useCallback((speed: AnimationSpeed) => {
    setAnimationSpeedState(speed);
  }, []);

  const setAnimationDuration = useCallback((duration: number) => {
    const clamped = Math.round(Math.min(5.0, Math.max(0.2, duration)) * 100) / 100;
    setAnimationDurationState(clamped);
  }, []);

  const contextValue = useMemo(() => ({
    theme, setTheme, toggleTheme, switchThemeWithAnimation: switchWithAnimation,
    uiScale, setUiScale,
    animationSpeed, setAnimationSpeed,
    animationDuration, setAnimationDuration,
  }), [theme, setTheme, toggleTheme, switchWithAnimation, uiScale, setUiScale, animationSpeed, setAnimationSpeed, animationDuration, setAnimationDuration]);

  return (
    <ThemeContext.Provider value={contextValue}>
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
