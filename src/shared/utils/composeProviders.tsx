import React from 'react';
import { HashRouter } from 'react-router-dom';
import { ShellProvider } from '../stores/shellStore';
import { ThemeProvider } from '../stores/themeStore';
import { I18nProvider } from '../i18n';
import { AuthProvider } from '../stores/authStore';
import { ConfigProvider } from '../stores/configStore';
import { InstanceProvider } from '../stores/instanceStore';
import { ToastProvider } from '../stores/toastStore';
import { DownloadProvider } from '../stores/downloadStore';
import { SocialProvider } from '../stores/socialStore';
import { ChatProvider } from '../stores/chatStore';
import { AIAssistantProvider } from '../stores/aiAssistantStore';

export function composeProviders(providers: React.ComponentType<{ children: React.ReactNode }>[]) {
  return ({ children }: { children: React.ReactNode }) =>
    providers.reduceRight((acc, Provider) => <Provider>{acc}</Provider>, children);
}

const providers = [
  // Router must be outermost so hooks like useNavigate work in all providers/shells
  HashRouter as unknown as React.ComponentType<{ children: React.ReactNode }>,
  // Shell state — determines which shell renders (theme variant depends on this)
  ShellProvider,
  // Theme — reads shell state to apply correct theme variant
  ThemeProvider,
  // I18n — translations available everywhere
  I18nProvider,
  // Auth — user session, must be before InstanceProvider
  AuthProvider,
  // Config — app settings
  ConfigProvider,
  // Instance — game instances, depends on auth
  InstanceProvider,
  // Toast — notification queue
  ToastProvider,
  // Download — download task queue
  DownloadProvider,
  // Social — friends/social features
  SocialProvider,
  // Chat — AI chat state
  ChatProvider,
  // AI Assistant — AI panel state
  AIAssistantProvider,
];

export const AppProviders = composeProviders(providers);
