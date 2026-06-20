import { useState, useEffect, useCallback, useRef } from 'react';

export interface DiscoveryTip {
  id: string;
  trigger: 'first_visit' | 'first_action';
  page: string;
  target: string;
  title: string;
  description: string;
}

const STORAGE_KEY = 'bonnext_discovery_tips';

const ALL_TIPS: DiscoveryTip[] = [
  {
    id: 'mod_management',
    trigger: 'first_visit',
    page: '/instances',
    target: '[data-discovery="instance-mods"]',
    title: 'Mod Management',
    description:
      'Click on any instance to manage its mods, resource packs, and shaders. Enable, disable, or remove content with one click.',
  },
  {
    id: 'version_switching',
    trigger: 'first_visit',
    page: '/versions',
    target: '[data-discovery="version-list"]',
    title: 'Version Switching',
    description:
      'Browse and download any Minecraft version — releases, snapshots, and old alphas. Switch versions per instance anytime.',
  },
  {
    id: 'collections',
    trigger: 'first_visit',
    page: '/store',
    target: '[data-discovery="collection-btn"]',
    title: 'Save to Collections',
    description:
      'Heart any mod, shader, or resource pack to save it to your collection for later. Access saved items from the Collections page.',
  },
  {
    id: 'settings_optimize',
    trigger: 'first_visit',
    page: '/settings',
    target: '[data-discovery="settings-memory"]',
    title: 'Optimize Performance',
    description:
      'Fine-tune memory allocation, JVM arguments, and Java path here. Use Auto-Tune for optimal settings based on your hardware.',
  },
  {
    id: 'quick_launch',
    trigger: 'first_visit',
    page: '/home',
    target: '[data-discovery="play-area"]',
    title: 'Quick Launch',
    description:
      'Click the PLAY area to launch your game instantly. Switch between instances using the dropdown selector.',
  },
  {
    id: 'browse_mods',
    trigger: 'first_visit',
    page: '/home',
    target: '[data-discovery="browse-mods-btn"]',
    title: 'Browse Mods',
    description:
      'Explore thousands of mods, modpacks, and shaders from Modrinth and CurseForge. Install with a single click.',
  },
];

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr: string[] = JSON.parse(raw);
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* empty */
  }
}

export function useDiscoveryTips(currentPage: string) {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [activeTip, setActiveTip] = useState<DiscoveryTip | null>(null);
  const pageVisitCountRef = useRef<Record<string, number>>({});

  useEffect(() => {
    pageVisitCountRef.current[currentPage] = (pageVisitCountRef.current[currentPage] || 0) + 1;
  }, [currentPage]);

  useEffect(() => {
    const eligible = ALL_TIPS.find(
      (tip) =>
        tip.page === currentPage &&
        !dismissed.has(tip.id) &&
        (tip.trigger === 'first_visit' || pageVisitCountRef.current[currentPage] === 1),
    );

    if (eligible) {
      const timer = setTimeout(() => setActiveTip(eligible), 1200);
      return () => clearTimeout(timer);
    } else {
      setActiveTip(null);
    }
  }, [currentPage, dismissed]);

  const dismissTip = useCallback((tipId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(tipId);
      saveDismissed(next);
      return next;
    });
    setActiveTip(null);
  }, []);

  const resetAllTips = useCallback(() => {
    setDismissed(new Set());
    saveDismissed(new Set());
  }, []);

  return { activeTip, dismissTip, resetAllTips, allTips: ALL_TIPS };
}
