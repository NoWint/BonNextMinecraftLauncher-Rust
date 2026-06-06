import { useState, useEffect } from 'react';

export type Breakpoint = 'narrow' | 'medium' | 'wide';

interface ResponsiveState {
  breakpoint: Breakpoint;
  isNarrow: boolean;
  isMedium: boolean;
  isWide: boolean;
  sidebarWidth: number;
}

export function useResponsive(): ResponsiveState {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('wide');

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 768) setBreakpoint('narrow');
      else if (w < 1024) setBreakpoint('medium');
      else setBreakpoint('wide');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return {
    breakpoint,
    isNarrow: breakpoint === 'narrow',
    isMedium: breakpoint === 'medium',
    isWide: breakpoint === 'wide',
    sidebarWidth: breakpoint === 'narrow' ? 48 : 220,
  };
}
