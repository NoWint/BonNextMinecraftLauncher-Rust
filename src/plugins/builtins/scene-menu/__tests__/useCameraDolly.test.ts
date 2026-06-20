import { describe, it, expect } from 'vitest';
import {
  clampPosition,
  breathingOffset,
  parallaxOffset,
  transitionOffset,
  SAFE_RANGE,
  type CameraOffset,
} from '../hooks/useCameraDolly';

describe('useCameraDolly math', () => {
  it('clampPosition clamps translate to ±0.3 and push to [0, 0.5]', () => {
    expect(clampPosition({ x: 1, y: -1, z: 2 })).toEqual({ x: 0.3, y: -0.3, z: 0.5 });
    expect(clampPosition({ x: -1, y: 1, z: -1 })).toEqual({ x: -0.3, y: 0.3, z: 0 });
    expect(clampPosition({ x: 0.1, y: -0.1, z: 0.2 })).toEqual({ x: 0.1, y: -0.1, z: 0.2 });
  });

  it('breathingOffset stays within safe range for any t', () => {
    for (const t of [0, 1, 3, 6, 12, 100, 1000]) {
      const o = breathingOffset(t, 6);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(SAFE_RANGE.translate);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(SAFE_RANGE.translate);
      expect(o.z).toBeGreaterThanOrEqual(0);
      expect(o.z).toBeLessThanOrEqual(SAFE_RANGE.push);
    }
  });

  it('breathingOffset is zero at t=0', () => {
    expect(breathingOffset(0, 6)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('parallaxOffset scales mouse [-1,1] to ±strength and clamps', () => {
    const o = parallaxOffset(1, 1, 0.15);
    expect(o.x).toBeCloseTo(0.15);
    expect(o.y).toBeCloseTo(0.15);
    const clamped = parallaxOffset(10, 10, 0.15);
    expect(clamped.x).toBeLessThanOrEqual(SAFE_RANGE.translate);
  });

  it('transitionOffset eases from 0 to target over duration', () => {
    expect(transitionOffset(0, { x: 0.4, y: 0, z: 0 }, 600)).toEqual({ x: 0, y: 0, z: 0 });
    const end = transitionOffset(600, { x: 0.4, y: 0, z: 0 }, 600);
    expect(end.x).toBeCloseTo(0.4, 2);
    const mid = transitionOffset(300, { x: 0.4, y: 0, z: 0 }, 600);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(0.4);
  });
});
