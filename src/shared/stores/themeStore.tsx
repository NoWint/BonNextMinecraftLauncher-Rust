import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePluginThemes } from '../../app/hooks/usePluginThemes';

export type Theme = 'dark' | 'light' | 'oled';
export type AnimationSpeed = 'fast' | 'normal' | 'smooth' | 'custom';
export type LayoutStyle = 'zzz' | 'minimalist';
export type HomeMode = 'dashboard' | 'minimalist';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  switchThemeWithAnimation: (newTheme: Theme) => void;
  uiScale: number;
  setUiScale: (scale: number) => void;
  autoScale: boolean;
  setAutoScale: (auto: boolean) => void;
  animationSpeed: AnimationSpeed;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  animationDuration: number;
  setAnimationDuration: (duration: number) => void;
  layoutStyle: LayoutStyle;
  setLayoutStyle: (style: LayoutStyle) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  density: 'compact' | 'comfortable' | 'spacious';
  setDensity: (density: 'compact' | 'comfortable' | 'spacious') => void;
  autoDayNight: boolean;
  setAutoDayNight: (auto: boolean) => void;
  homeMode: HomeMode;
  setHomeMode: (mode: HomeMode) => void;
  homeBackground: string | null;
  setHomeBackground: (bg: string | null) => void;
  homeBlurEnabled: boolean;
  setHomeBlurEnabled: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'bonnext:theme';
const UI_SCALE_STORAGE_KEY = 'bonnext:ui-scale';
const AUTO_SCALE_STORAGE_KEY = 'bonnext:auto-scale';
const ANIM_SPEED_STORAGE_KEY = 'bonnext:animation-speed';
const ANIM_DURATION_STORAGE_KEY = 'bonnext:animation-duration';
const LAYOUT_STYLE_STORAGE_KEY = 'bonnext:layout-style';
const SIDEBAR_WIDTH_STORAGE_KEY = 'bonnext:sidebar-width';
const DENSITY_STORAGE_KEY = 'bonnext:density';
const AUTO_DAY_NIGHT_STORAGE_KEY = 'bonnext:auto-day-night';
const HOME_MODE_STORAGE_KEY = 'bonnext:home-mode';
const HOME_BACKGROUND_STORAGE_KEY = 'bonnext:home-background';
const HOME_BLUR_ENABLED_STORAGE_KEY = 'bonnext:home-blur-enabled';
const UI_SCALE_MIN = 0.5;
const UI_SCALE_MAX = 2.0;
const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 360;
const SIDEBAR_WIDTH_DEFAULT = 248;

const DESIGN_WIDTH = 1200;
const DESIGN_HEIGHT = 800;

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
  } catch {
    /* empty */
  }
  return 'dark';
}

function getInitialUiScale(): number {
  try {
    const stored = localStorage.getItem(UI_SCALE_STORAGE_KEY);
    if (stored !== null) {
      const val = parseFloat(stored);
      if (!isNaN(val) && val >= UI_SCALE_MIN && val <= UI_SCALE_MAX) return val;
    }
  } catch {
    /* empty */
  }
  return computeAutoScale();
}

function computeAutoScale(): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scaleW = w / DESIGN_WIDTH;
  const scaleH = h / DESIGN_HEIGHT;
  const scale = Math.min(scaleW, scaleH);
  return Math.round(Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, scale)) * 100) / 100;
}

function getInitialAnimationSpeed(): AnimationSpeed {
  try {
    const stored = localStorage.getItem(ANIM_SPEED_STORAGE_KEY);
    if (stored === 'fast' || stored === 'normal' || stored === 'smooth' || stored === 'custom') return stored;
  } catch {
    /* empty */
  }
  return 'normal';
}

function getInitialAnimationDuration(): number {
  try {
    const stored = localStorage.getItem(ANIM_DURATION_STORAGE_KEY);
    if (stored !== null) {
      const val = parseFloat(stored);
      if (!isNaN(val) && val >= 0.2 && val <= 5.0) return val;
    }
  } catch {
    /* empty */
  }
  return 1.0;
}

function getInitialLayoutStyle(): LayoutStyle {
  try {
    const stored = localStorage.getItem(LAYOUT_STYLE_STORAGE_KEY);
    if (stored === 'zzz' || stored === 'minimalist') return stored;
  } catch {
    /* empty */
  }
  return 'zzz';
}

function getInitialSidebarWidth(): number {
  try {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (stored !== null) {
      const val = parseInt(stored, 10);
      if (!isNaN(val) && val >= SIDEBAR_WIDTH_MIN && val <= SIDEBAR_WIDTH_MAX) return val;
    }
  } catch {
    /* empty */
  }
  return SIDEBAR_WIDTH_DEFAULT;
}

function getInitialDensity(): 'compact' | 'comfortable' | 'spacious' {
  try {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (stored === 'compact' || stored === 'comfortable' || stored === 'spacious') return stored;
  } catch {
    /* empty */
  }
  return 'comfortable';
}

function getInitialAutoDayNight(): boolean {
  try {
    return localStorage.getItem(AUTO_DAY_NIGHT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 根据当前小时判断白天/夜间。
 * 6:00-18:00 为白天（浅色），其余为夜间（深色）。
 * 跨平台：仅使用本地时间，无平台特定代码。
 */
function isDaytime(): boolean {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18;
}

function getInitialHomeMode(): HomeMode {
  try {
    const stored = localStorage.getItem(HOME_MODE_STORAGE_KEY);
    if (stored === 'dashboard' || stored === 'minimalist') return stored;
  } catch {
    /* empty */
  }
  return 'dashboard';
}

function getInitialHomeBackground(): string | null {
  try {
    return localStorage.getItem(HOME_BACKGROUND_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getInitialHomeBlurEnabled(): boolean {
  try {
    const stored = localStorage.getItem(HOME_BLUR_ENABLED_STORAGE_KEY);
    // 默认开启模糊
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

const THEME_CLASS_MAP: Record<Theme, string> = {
  dark: 'theme-dark',
  light: 'theme-light',
  oled: 'theme-oled',
};

const LAYOUT_CLASS_MAP: Record<LayoutStyle, string> = {
  zzz: 'layout-zzz',
  minimalist: 'layout-minimalist',
};

const DENSITY_CLASS_MAP: Record<'compact' | 'comfortable' | 'spacious', string> = {
  compact: 'density-compact',
  comfortable: 'density-comfortable',
  spacious: 'density-spacious',
};

const THEME_CYCLE: Theme[] = ['dark', 'light', 'oled'];

function applyUiScale(scale: number) {
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  document.documentElement.style.fontSize = `${scale * 16}px`;
}

function applyLayoutStyle(style: LayoutStyle) {
  const root = document.documentElement;
  root.classList.remove('layout-zzz', 'layout-minimalist');
  root.classList.add(LAYOUT_CLASS_MAP[style]);
}

function applySidebarWidth(width: number) {
  document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
}

function applyDensity(density: 'compact' | 'comfortable' | 'spacious') {
  const root = document.documentElement;
  root.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
  root.classList.add(DENSITY_CLASS_MAP[density]);
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
    } catch {
      /* empty */
    }
    setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 350);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [autoScale, setAutoScaleState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(AUTO_SCALE_STORAGE_KEY);
      if (stored !== null) return stored === 'true';
    } catch {
      /* empty */
    }
    return true;
  });
  const [uiScale, setUiScaleState] = useState<number>(getInitialUiScale);
  const [animationSpeed, setAnimationSpeedState] = useState<AnimationSpeed>(getInitialAnimationSpeed);
  const [animationDuration, setAnimationDurationState] = useState<number>(getInitialAnimationDuration);
  const [layoutStyle, setLayoutStyleState] = useState<LayoutStyle>(getInitialLayoutStyle);
  const [sidebarWidth, setSidebarWidthState] = useState<number>(getInitialSidebarWidth);
  const [density, setDensityState] = useState<'compact' | 'comfortable' | 'spacious'>(getInitialDensity);
  const [autoDayNight, setAutoDayNightState] = useState<boolean>(getInitialAutoDayNight);
  const [homeMode, setHomeModeState] = useState<HomeMode>(getInitialHomeMode);
  const [homeBackground, setHomeBackgroundState] = useState<string | null>(getInitialHomeBackground);
  const [homeBlurEnabled, setHomeBlurEnabledState] = useState<boolean>(getInitialHomeBlurEnabled);
  const pluginThemes = usePluginThemes();
  const appliedThemeVarsRef = useRef<string[]>([]);

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
    } catch {
      /* empty */
    }
  }, [theme, applyThemeClass]);

  // Apply plugin-contributed theme CSS variables additively.
  // A contribution is applied when its id ends with the active theme id
  // (e.g. 'zzz-dark' matches theme 'dark', 'zzz-oled' matches theme 'oled').
  // This precise matching prevents mutually-exclusive variants that share a
  // mode (zzz-dark and zzz-oled are both mode 'dark') from overriding each
  // other. 'auto' mode contributions apply to every theme.
  useEffect(() => {
    const root = document.documentElement;
    // Remove previously applied plugin theme variables
    for (const key of appliedThemeVarsRef.current) {
      root.style.removeProperty(key);
    }
    const themeSuffix = `-${theme}`;
    const applied: string[] = [];
    for (const contribution of pluginThemes) {
      const matches =
        contribution.mode === 'auto' || contribution.id.endsWith(themeSuffix);
      if (!matches) continue;
      for (const [key, value] of Object.entries(contribution.cssVariables)) {
        root.style.setProperty(key, value);
        applied.push(key);
      }
    }
    appliedThemeVarsRef.current = applied;
  }, [pluginThemes, theme]);

  useEffect(() => {
    applyUiScale(uiScale);
    try {
      localStorage.setItem(UI_SCALE_STORAGE_KEY, String(uiScale));
    } catch {
      /* empty */
    }
  }, [uiScale]);

  useEffect(() => {
    if (!autoScale) return;
    const handleResize = () => {
      const newScale = computeAutoScale();
      setUiScaleState((prev) => (Math.abs(prev - newScale) > 0.01 ? newScale : prev));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [autoScale]);

  useEffect(() => {
    applyAnimationSpeed(animationSpeed, animationDuration);
    try {
      localStorage.setItem(ANIM_SPEED_STORAGE_KEY, animationSpeed);
      localStorage.setItem(ANIM_DURATION_STORAGE_KEY, String(animationDuration));
    } catch {
      /* empty */
    }
  }, [animationSpeed, animationDuration, applyAnimationSpeed]);

  useEffect(() => {
    applyLayoutStyle(layoutStyle);
    try {
      localStorage.setItem(LAYOUT_STYLE_STORAGE_KEY, layoutStyle);
    } catch {
      /* empty */
    }
  }, [layoutStyle]);

  useEffect(() => {
    applySidebarWidth(sidebarWidth);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    } catch {
      /* empty */
    }
  }, [sidebarWidth]);

  useEffect(() => {
    applyDensity(density);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch {
      /* empty */
    }
  }, [density]);

  // 自动昼夜主题：每 10 分钟检查一次，白天浅色、夜间深色。
  // 用户手动切换主题时会关闭 autoDayNight（在 setAutoDayNight 中处理）。
  useEffect(() => {
    if (!autoDayNight) return;
    const apply = () => {
      const targetTheme: Theme = isDaytime() ? 'light' : 'dark';
      setThemeState((current) => {
        if (current === targetTheme) return current;
        applyThemeClass(targetTheme);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, targetTheme);
        } catch {
          /* empty */
        }
        return targetTheme;
      });
    };
    apply();
    const timer = setInterval(apply, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [autoDayNight]);

  const setAutoDayNight = useCallback((auto: boolean) => {
    setAutoDayNightState(auto);
    try {
      localStorage.setItem(AUTO_DAY_NIGHT_STORAGE_KEY, auto ? '1' : '0');
    } catch {
      /* empty */
    }
  }, []);

  const setHomeMode = useCallback((mode: HomeMode) => {
    setHomeModeState(mode);
    try {
      localStorage.setItem(HOME_MODE_STORAGE_KEY, mode);
    } catch {
      /* empty */
    }
  }, []);

  const setHomeBackground = useCallback((bg: string | null) => {
    setHomeBackgroundState(bg);
    try {
      if (bg) {
        localStorage.setItem(HOME_BACKGROUND_STORAGE_KEY, bg);
      } else {
        localStorage.removeItem(HOME_BACKGROUND_STORAGE_KEY);
      }
    } catch {
      /* empty */
    }
  }, []);

  const setHomeBlurEnabled = useCallback((enabled: boolean) => {
    setHomeBlurEnabledState(enabled);
    try {
      localStorage.setItem(HOME_BLUR_ENABLED_STORAGE_KEY, String(enabled));
    } catch {
      /* empty */
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const idx = THEME_CYCLE.indexOf(prev);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    });
  }, []);

  const switchWithAnimation = useCallback((newTheme: Theme) => {
    createThemeSwitcher(setThemeState)(newTheme);
  }, []);

  const setUiScale = useCallback((scale: number) => {
    const clamped = Math.round(Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, scale)) * 100) / 100;
    setUiScaleState(clamped);
  }, []);

  const setAutoScale = useCallback((auto: boolean) => {
    setAutoScaleState(auto);
    try {
      localStorage.setItem(AUTO_SCALE_STORAGE_KEY, String(auto));
    } catch {
      /* empty */
    }
    if (auto) {
      const newScale = computeAutoScale();
      setUiScaleState(newScale);
    }
  }, []);

  const setAnimationSpeed = useCallback((speed: AnimationSpeed) => {
    setAnimationSpeedState(speed);
  }, []);

  const setAnimationDuration = useCallback((duration: number) => {
    const clamped = Math.round(Math.min(5.0, Math.max(0.2, duration)) * 100) / 100;
    setAnimationDurationState(clamped);
  }, []);

  const setLayoutStyle = useCallback((style: LayoutStyle) => {
    setLayoutStyleState(style);
  }, []);

  const setSidebarWidth = useCallback((width: number) => {
    const clamped = Math.round(Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width)));
    setSidebarWidthState(clamped);
  }, []);

  const setDensity = useCallback((d: 'compact' | 'comfortable' | 'spacious') => {
    setDensityState(d);
  }, []);

  const contextValue = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      switchThemeWithAnimation: switchWithAnimation,
      uiScale,
      setUiScale,
      autoScale,
      setAutoScale,
      animationSpeed,
      setAnimationSpeed,
      animationDuration,
      setAnimationDuration,
      layoutStyle,
      setLayoutStyle,
      sidebarWidth,
      setSidebarWidth,
      density,
      setDensity,
      autoDayNight,
      setAutoDayNight,
      homeMode,
      setHomeMode,
      homeBackground,
      setHomeBackground,
      homeBlurEnabled,
      setHomeBlurEnabled,
    }),
    [
      theme,
      setTheme,
      toggleTheme,
      switchWithAnimation,
      uiScale,
      setUiScale,
      autoScale,
      setAutoScale,
      animationSpeed,
      setAnimationSpeed,
      animationDuration,
      setAnimationDuration,
      layoutStyle,
      setLayoutStyle,
      sidebarWidth,
      setSidebarWidth,
      density,
      setDensity,
      autoDayNight,
      setAutoDayNight,
      homeMode,
      setHomeMode,
      homeBackground,
      setHomeBackground,
      homeBlurEnabled,
      setHomeBlurEnabled,
    ],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export { UI_SCALE_MIN, UI_SCALE_MAX, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX };
