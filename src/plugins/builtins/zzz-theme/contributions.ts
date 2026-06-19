import type { ThemeContribution } from '@/plugins/core';

type ThemeContributionWithoutPluginId = Omit<ThemeContribution, 'pluginId'>;

export const zzzDarkContribution: ThemeContributionWithoutPluginId = {
  id: 'zzz-dark',
  name: 'ZZZ Dark',
  mode: 'dark',
  cssVariables: {
    '--bg-primary': '#0d0d0d',
    '--bg-secondary': '#141414',
    '--bg-card': '#1a1a1a',
    '--text-primary': '#ffffff',
    '--text-secondary': '#aaaaaa',
    '--text-muted': '#888888',
    '--accent': '#ffe600',
    '--border': '#1a1a1a',
    '--border-hover': '#2a2a2a',
    '--danger': '#ff4444',
    '--success': '#00ff88',
    '--color-sidebar': '#0f0f0f',
  },
};

export const zzzLightContribution: ThemeContributionWithoutPluginId = {
  id: 'zzz-light',
  name: 'ZZZ Light',
  mode: 'light',
  cssVariables: {
    '--bg-primary': '#fafafa',
    '--bg-secondary': '#f0f0f0',
    '--bg-card': '#ffffff',
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#555555',
    '--text-muted': '#777777',
    '--accent': '#ffe600',
    '--border': '#e5e5e5',
    '--border-hover': '#b0b0b0',
    '--danger': '#cc2222',
    '--success': '#00aa55',
    '--color-sidebar': '#f0f0f0',
  },
};

export const zzzOledContribution: ThemeContributionWithoutPluginId = {
  id: 'zzz-oled',
  name: 'ZZZ OLED',
  mode: 'dark',
  cssVariables: {
    '--bg-primary': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--bg-card': '#0f0f0f',
    '--text-primary': '#ffffff',
    '--text-secondary': '#999999',
    '--text-muted': '#777777',
    '--accent': '#ffe600',
    '--border': '#1a1a1a',
    '--border-hover': '#333333',
    '--danger': '#ff4444',
    '--success': '#00ff88',
    '--color-sidebar': '#050505',
  },
};
