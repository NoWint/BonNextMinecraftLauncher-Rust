import type { ThemeContribution } from '@/plugins/extensions';
import { MD3ColorSystem } from './colorSystem';

export const MD3_SEED_PRESETS = [
  { name: 'purple', color: '#6750A4', label: 'Material Purple' },
  { name: 'blue', color: '#0061A4', label: 'Ocean Blue' },
  { name: 'green', color: '#006D3B', label: 'Forest Green' },
  { name: 'red', color: '#BA1A1A', label: 'Crimson Red' },
  { name: 'orange', color: '#8B5000', label: 'Amber Orange' },
  { name: 'pink', color: '#9C4058', label: 'Rose Pink' },
  { name: 'teal', color: '#006B5E', label: 'Teal' },
] as const;

export function generateMD3Contributions(seedColor: string): ThemeContribution[] {
  const colorSystem = new MD3ColorSystem();
  const tokens = colorSystem.generateFromSeed(seedColor);

  const darkVars = colorSystem.getTokensForMode(tokens, 'dark');
  const lightVars = colorSystem.getTokensForMode(tokens, 'light');

  const darkContribution: ThemeContribution = {
    id: 'md3-dark',
    name: 'MD3 Dark',
    mode: 'dark',
    cssVariables: {
      ...darkVars,
      '--md3-seed-color': seedColor,
      '--md3-theme-mode': 'dark',
    },
  };

  const lightContribution: ThemeContribution = {
    id: 'md3-light',
    name: 'MD3 Light',
    mode: 'light',
    cssVariables: {
      ...lightVars,
      '--md3-seed-color': seedColor,
      '--md3-theme-mode': 'light',
    },
  };

  return [darkContribution, lightContribution];
}
