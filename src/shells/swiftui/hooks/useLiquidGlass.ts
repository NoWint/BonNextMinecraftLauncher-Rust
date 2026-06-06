import { useState, useEffect, useCallback, useRef } from 'react';

interface LiquidGlassState {
  /** Whether native Liquid Glass (macOS 26+ NSGlassEffectView) is available */
  isNativeLiquid: boolean;
  /** Apply native Liquid Glass effect to the window. Returns true if successful. */
  applyNativeGlass: () => Promise<boolean>;
  /** Remove native glass effect from the window */
  removeNativeGlass: () => Promise<void>;
  /** React ref callback for applying DOM-level Liquid Glass to an element */
  glassRef: (intensity?: 'subtle' | 'normal' | 'strong') => (el: HTMLElement | null) => void;
}

/**
 * Hook for Liquid Glass support.
 *
 * macOS 26+ → Native NSGlassEffectView (window-level) + DOM-level CSS refraction
 * Other platforms → DOM-level CSS refraction via liquid-glass-component-kit
 */
export function useLiquidGlass(): LiquidGlassState {
  const [isNativeLiquid, setIsNativeLiquid] = useState(false);
  const effectsRef = useRef<ReturnType<typeof import('liquid-glass-component-kit').applyLiquidGlass>[]>([]);

  // Detect native Liquid Glass support
  useEffect(() => {
    (async () => {
      try {
        const { isGlassSupported } = await import('tauri-plugin-liquid-glass-api');
        const supported = await isGlassSupported();
        setIsNativeLiquid(supported);
      } catch {
        setIsNativeLiquid(false);
      }
    })();
  }, []);

  // Cleanup DOM-level effects on unmount
  useEffect(() => {
    return () => {
      effectsRef.current.forEach(effect => {
        try { effect.remove(); } catch { /* ignore */ }
      });
      effectsRef.current = [];
    };
  }, []);

  // Apply native window-level Liquid Glass (macOS 26+ only)
  const applyNativeGlass = useCallback(async (): Promise<boolean> => {
    try {
      const { isGlassSupported, setLiquidGlassEffect, GlassMaterialVariant } = await import('tauri-plugin-liquid-glass-api');
      const supported = await isGlassSupported();
      if (supported) {
        await setLiquidGlassEffect({
          enabled: true,
          variant: GlassMaterialVariant.Sidebar,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Remove native window-level Liquid Glass
  const removeNativeGlass = useCallback(async () => {
    try {
      const { setLiquidGlassEffect } = await import('tauri-plugin-liquid-glass-api');
      await setLiquidGlassEffect({ enabled: false });
    } catch {
      // ignore
    }
  }, []);

  // DOM-level Liquid Glass ref callback
  // Usage: <div ref={glassRef('normal')}>
  const glassRef = useCallback((intensity: 'subtle' | 'normal' | 'strong' = 'normal') => {
    return (el: HTMLElement | null) => {
      if (!el) return;
      (async () => {
        try {
          const { applyLiquidGlass } = await import('liquid-glass-component-kit');
          const effect = applyLiquidGlass(el, { intensity });
          effectsRef.current.push(effect);
        } catch {
          // Fallback: no DOM-level liquid glass
        }
      })();
    };
  }, []);

  return { isNativeLiquid, applyNativeGlass, removeNativeGlass, glassRef };
}
