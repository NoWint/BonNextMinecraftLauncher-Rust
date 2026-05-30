import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeExtensionPoint } from '../ThemeExtensionPoint';
import type { ThemeContribution } from '../ThemeExtensionPoint';

describe('ThemeExtensionPoint', () => {
  let point: ThemeExtensionPoint;

  const darkContribution: ThemeContribution = {
    id: 'zzz-dark',
    name: 'ZZZ Dark',
    cssVariables: { '--bg-primary': '#0d0d0d' },
    mode: 'dark',
  };

  const lightContribution: ThemeContribution = {
    id: 'zzz-light',
    name: 'ZZZ Light',
    cssVariables: { '--bg-primary': '#fafafa' },
    mode: 'light',
  };

  beforeEach(() => {
    point = new ThemeExtensionPoint();
  });

  it('should have correct id and name', () => {
    expect(point.id).toBe('bonnext:theme');
    expect(point.name).toBe('Theme Extension Point');
  });

  it('should accept theme contributions', () => {
    point.onContribute(darkContribution);
    expect(point.getContributions()).toHaveLength(1);
    expect(point.getContributions()[0].id).toBe('zzz-dark');
  });

  it('should retract theme contributions', () => {
    point.onContribute(darkContribution);
    point.onRetract(darkContribution);
    expect(point.getContributions()).toHaveLength(0);
  });

  it('should find contribution by id', () => {
    point.onContribute(darkContribution);
    point.onContribute(lightContribution);
    expect(point.getContributionById('zzz-dark')).toBe(darkContribution);
    expect(point.getContributionById('zzz-light')).toBe(lightContribution);
    expect(point.getContributionById('unknown')).toBeUndefined();
  });

  it('should list available theme ids', () => {
    point.onContribute(darkContribution);
    point.onContribute(lightContribution);
    expect(point.getAvailableThemeIds()).toEqual(['zzz-dark', 'zzz-light']);
  });

  it('should notify listeners on contribute', () => {
    const events: string[] = [];
    point.addListener((e) => events.push(e.type));
    point.onContribute(darkContribution);
    expect(events).toEqual(['contribute']);
  });

  it('should notify listeners on retract', () => {
    const events: string[] = [];
    point.addListener((e) => events.push(e.type));
    point.onContribute(darkContribution);
    point.onRetract(darkContribution);
    expect(events).toEqual(['contribute', 'retract']);
  });

  it('should unsubscribe listener', () => {
    const events: string[] = [];
    const unsub = point.addListener((e) => events.push(e.type));
    unsub();
    point.onContribute(darkContribution);
    expect(events).toHaveLength(0);
  });
});
