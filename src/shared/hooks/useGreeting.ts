import { useMemo } from 'react';
import type { IconName } from '../../components/ui/Icon';

const ICONS: Record<string, IconName[]> = {
  morning: ['sunrise', 'sun', 'pickaxe', 'sunset'],
  afternoon: ['construction', 'bolt', 'target', 'crystal'],
  evening: ['moon', 'tent', 'globe', 'candle'],
  night: ['night', 'wolf', 'bat', 'sparkles'],
};

interface Greeting {
  icon: IconName;
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
      icon: ICONS[period]?.[idx] || 'pickaxe',
      title: t(`greeting.${period}.${idx}`),
      subtitle: t(`greeting.sub.${period}.${idx}`),
    };
  }, [t]);
}

export function getRandomLoadingMessage(t: (key: string) => string): string {
  const idx = Math.floor(Math.random() * 12);
  return t(`greeting.loading.${idx}`);
}
