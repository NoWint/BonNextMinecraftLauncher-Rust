import React, { createContext, useContext, useState, useCallback, useEffect, useReducer } from 'react';
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
  } catch {
    /* empty */
  }
  const navLang =
    navigator.language || ((navigator as unknown as Record<string, unknown>).userLanguage as string) || '';
  if (navLang.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

// ─── 插件 i18n 资源管理 ───────────────────────────────────────────────
// 插件激活时注册其 manifest.i18n 资源，键前缀为 `plugin:<pluginId>:`。
// 模块级存储，通过订阅通知 React 组件重新渲染。

const PLUGIN_I18N_PREFIX = 'plugin:';

/** 插件 i18n 资源：pluginId → { lang → { relativeKey → value } } */
const pluginResources = new Map<string, Record<Lang, Record<string, string>>>();

/** 订阅者集合，资源变更时通知 */
const pluginResourceListeners = new Set<() => void>();

/**
 * 注册插件 i18n 资源。在插件激活时调用。
 * resources 中的键是相对于插件命名空间的（如 `sidebar.store`），
 * 解析时通过 `plugin:<pluginId>:<relativeKey>` 查找。
 */
export function registerPluginI18n(
  pluginId: string,
  resources: { 'en-US'?: Record<string, string>; 'zh-CN'?: Record<string, string> },
): void {
  const normalized: Record<Lang, Record<string, string>> = {
    'zh-CN': { ...(resources['zh-CN'] ?? {}) },
    'en-US': { ...(resources['en-US'] ?? {}) },
  };
  pluginResources.set(pluginId, normalized);
  notifyPluginResourceListeners();
}

/** 注销插件 i18n 资源。在插件停用/卸载时调用。 */
export function unregisterPluginI18n(pluginId: string): void {
  if (pluginResources.delete(pluginId)) {
    notifyPluginResourceListeners();
  }
}

/** 订阅插件 i18n 资源变更。返回取消订阅函数。 */
export function subscribePluginI18n(listener: () => void): () => void {
  pluginResourceListeners.add(listener);
  return () => {
    pluginResourceListeners.delete(listener);
  };
}

function notifyPluginResourceListeners(): void {
  pluginResourceListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* listener errors are ignored */
    }
  });
}

/**
 * 查找插件翻译。
 * @param lang 当前语言
 * @param pluginId 插件 ID
 * @param relativeKey 相对于插件命名空间的键（如 `sidebar.store`）
 * @returns 翻译值，找不到返回 undefined
 */
function getPluginTranslation(lang: Lang, pluginId: string, relativeKey: string): string | undefined {
  const dict = pluginResources.get(pluginId);
  if (!dict) return undefined;
  return dict[lang][relativeKey] ?? dict[lang === 'zh-CN' ? 'en-US' : 'zh-CN'][relativeKey];
}

/**
 * 解析可能带插件命名空间前缀的 i18n 键。
 * 格式：`plugin:<pluginId>:<relativeKey>`
 * @returns 如果是插件键且找到翻译，返回 { pluginId, relativeKey }；否则返回 null
 */
function parsePluginKey(key: string): { pluginId: string; relativeKey: string } | null {
  if (!key.startsWith(PLUGIN_I18N_PREFIX)) return null;
  const rest = key.slice(PLUGIN_I18N_PREFIX.length);
  const colonIdx = rest.indexOf(':');
  if (colonIdx <= 0) return null;
  return {
    pluginId: rest.slice(0, colonIdx),
    relativeKey: rest.slice(colonIdx + 1),
  };
}

/** 插值 {param} 占位符 */
function interpolate(value: string, params?: Record<string, string>): string {
  if (!params) return value;
  let result = value;
  for (const [k, v] of Object.entries(params)) {
    result = result.replace(`{${k}}`, v);
  }
  return result;
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
export { I18nContext };

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectBrowserLang);
  // 插件资源变更计数器，触发 t 函数重建和消费者重渲染
  const [pluginVersion, forcePluginUpdate] = useReducer((x: number) => x + 1, 0);

  // 订阅插件 i18n 资源变更
  useEffect(() => subscribePluginI18n(forcePluginUpdate), []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      /* empty */
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      // 1. 优先解析插件命名空间键 plugin:<pluginId>:<relativeKey>
      const pluginKey = parsePluginKey(key);
      if (pluginKey) {
        const pluginValue = getPluginTranslation(lang, pluginKey.pluginId, pluginKey.relativeKey);
        if (pluginValue !== undefined) {
          return interpolate(pluginValue, params);
        }
        // 插件键未找到翻译 → 回退到原 key（不查全局字典，避免泄漏其他插件翻译）
        return key;
      }

      // 2. 查全局字典
      const dict = translations[lang];
      let value = dict[key];
      if (value === undefined) {
        // Fallback to Chinese if key doesn't exist in current language
        value = translations['zh-CN'][key] || key;
      }
      return interpolate(value, params);
    },
    [lang, pluginVersion],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/**
 * 解析插件标签。如果 label 是 { i18nKey }，通过 t() 解析；否则原样返回字符串。
 * 供 usePluginSidebarItems 等消费 hook 使用。
 */
export function resolvePluginLabel(
  label: string | { i18nKey: string },
  t: (key: string, params?: Record<string, string>) => string,
): string {
  return typeof label === 'string' ? label : t(label.i18nKey);
}
