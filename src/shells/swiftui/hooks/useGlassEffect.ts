import { useRef, useEffect } from 'react';

type GlassIntensity = 'subtle' | 'normal' | 'strong';

/**
 * Apply DOM-level Liquid Glass effect to an element.
 * Uses liquid-glass-component-kit for SVG refraction + specular highlights.
 * Falls back to CSS backdrop-filter blur if the library is unavailable.
 *
 * Usage:
 *   const ref = useGlassEffect<HTMLDivElement>('normal');
 *   return <div ref={ref}>...</div>;
 */
export function useGlassEffect<T extends HTMLElement = HTMLDivElement>(intensity: GlassIntensity = 'normal') {
  const ref = useRef<T>(null);
  const effectRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    (async () => {
      try {
        const { applyLiquidGlass } = await import('liquid-glass-component-kit');
        effectRef.current = applyLiquidGlass(el, { intensity });
      } catch {
        // Fallback: CSS backdrop-filter blur is already applied via glass-* classes
      }
    })();

    return () => {
      effectRef.current?.remove();
      effectRef.current = null;
    };
  }, [intensity]);

  return ref;
}
