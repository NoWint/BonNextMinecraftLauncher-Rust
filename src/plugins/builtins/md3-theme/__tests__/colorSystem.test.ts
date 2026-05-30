import { describe, it, expect } from 'vitest';
import { MD3ColorSystem } from '../colorSystem';

describe('MD3ColorSystem', () => {
  const colorSystem = new MD3ColorSystem();

  it('should generate tonal palettes from seed color', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    expect(tokens.primary).toBeDefined();
    expect(tokens.secondary).toBeDefined();
    expect(tokens.tertiary).toBeDefined();
    expect(tokens.neutral).toBeDefined();
    expect(tokens.neutralVariant).toBeDefined();
    expect(tokens.error).toBeDefined();
  });

  it('should generate 22 tones per palette', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    const tones = Object.keys(tokens.primary);
    expect(tones).toHaveLength(22);
    expect(tones).toContain('0');
    expect(tones).toContain('100');
  });

  it('should generate valid hex colors', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    for (const value of Object.values(tokens.primary)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('should produce different palettes for different seeds', () => {
    const violet = colorSystem.generateFromSeed('#6750A4');
    const blue = colorSystem.generateFromSeed('#0061A4');
    expect(violet.primary[40]).not.toBe(blue.primary[40]);
  });

  it('should generate CSS variables for dark mode', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    const vars = colorSystem.getTokensForMode(tokens, 'dark');
    expect(vars['--md3-primary']).toBeDefined();
    expect(vars['--md3-surface']).toBeDefined();
    expect(vars['--md3-on-surface']).toBeDefined();
  });

  it('should generate CSS variables for light mode', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    const vars = colorSystem.getTokensForMode(tokens, 'light');
    expect(vars['--md3-primary']).toBeDefined();
    expect(vars['--md3-surface']).toBeDefined();
    expect(vars['--md3-on-surface']).toBeDefined();
  });

  it('should map to existing variable system', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    const vars = colorSystem.getTokensForMode(tokens, 'dark');
    expect(vars['--bg-primary']).toBeDefined();
    expect(vars['--accent']).toBeDefined();
    expect(vars['--text-primary']).toBeDefined();
  });
});
