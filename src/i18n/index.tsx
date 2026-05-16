import React, { createContext, useContext, useState, useCallback } from 'react';
import zhCN from './zh-CN';
import enUS from './en-US';

export type Lang = 'zh-CN' | 'en-US';

const translations: Record<Lang, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const LANG_STORAGE_KEY = 'bonnext:lang';

function detectBrowserLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'zh-CN' || stored === 'en-US') return stored;
  } catch {}
  const navLang = navigator.language || (navigator as any).userLanguage || '';
  if (navLang.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectBrowserLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      const dict = translations[lang];
      let value = dict[key];
      if (value === undefined) {
        // Fallback to Chinese if key doesn't exist in current language
        value = translations['zh-CN'][key] || key;
      }
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.replace(`{${k}}`, v);
        });
      }
      return value;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
