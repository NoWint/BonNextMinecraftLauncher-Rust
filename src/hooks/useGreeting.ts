import { useMemo } from 'react';

const EMOJIS: Record<string, string[]> = {
  morning: ['🌅', '☀️', '⛏', '🌄'],
  afternoon: ['🏗', '⚡', '🎯', '🔮'],
  evening: ['🌙', '🏕', '🌌', '🕯'],
  night: ['🌃', '🐺', '🦇', '✨'],
};

interface Greeting {
  emoji: string;
  title: string;
  subtitle: string;
}

function getPeriod(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function useGreeting(t: (key: string) => string): Greeting {
  return useMemo(() => {
    const period = getPeriod();
    const idx = Math.floor(Math.random() * 4);
    return {
      emoji: EMOJIS[period]?.[idx] || '⛏',
      title: t(`greeting.${period}.${idx}`),
      subtitle: t(`greeting.sub.${period}.${idx}`),
    };
  // Only re-run when language changes — t function reference is stable per lang
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);
}

export function getRandomLoadingMessage(t: (key: string) => string): string {
  const idx = Math.floor(Math.random() * 12);
  return t(`greeting.loading.${idx}`);
}
