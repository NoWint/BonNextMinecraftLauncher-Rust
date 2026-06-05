import type { GameInstance } from '../../shared/api';

export interface SearchSourceResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: string;
  category: string;
  action: () => void;
}

export interface SearchSource {
  id: string;
  label: string;
  priority: number;
  search(query: string): SearchSourceResult[];
}

export class InstanceSearchSource implements SearchSource {
  id = 'instances';
  label = 'searchPalette.categoryInstances';
  priority = 10;

  private instances: GameInstance[];
  private navigateToInstance: (id: string) => void;

  constructor(instances: GameInstance[], navigateToInstance: (id: string) => void) {
    this.instances = instances;
    this.navigateToInstance = navigateToInstance;
  }

  search(query: string): SearchSourceResult[] {
    const q = query.toLowerCase();
    return this.instances
      .filter(
        (inst) =>
          !q ||
          inst.name.toLowerCase().includes(q) ||
          inst.version_id.toLowerCase().includes(q) ||
          (inst.loader_type && inst.loader_type.toLowerCase().includes(q)),
      )
      .map((inst) => ({
        id: `instance-${inst.id}`,
        type: 'instance',
        title: inst.name,
        subtitle: `${inst.version_id}${inst.loader_type ? ' · ' + inst.loader_type : ''} · ${Math.round(inst.max_memory / 1024)}GB`,
        icon: 'P',
        category: this.label,
        action: () => this.navigateToInstance(inst.id),
      }));
  }
}

export class NavigationSearchSource implements SearchSource {
  id = 'navigation';
  label = 'searchPalette.categoryNavigation';
  priority = 30;

  private items: Omit<SearchSourceResult, 'action' | 'category'>[];
  private navigate: (id: string) => void;

  constructor(items: Omit<SearchSourceResult, 'action' | 'category'>[], navigate: (id: string) => void) {
    this.items = items;
    this.navigate = navigate;
  }

  search(query: string): SearchSourceResult[] {
    const q = query.toLowerCase();
    return this.items
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q))
      .map((p) => ({
        ...p,
        category: this.label,
        action: () => this.navigate(p.id),
      }));
  }
}

export class SettingsSearchSource implements SearchSource {
  id = 'settings';
  label = 'searchPalette.categorySettings';
  priority = 40;

  private items: Omit<SearchSourceResult, 'action' | 'category'>[];
  private navigateToSettings: () => void;

  constructor(items: Omit<SearchSourceResult, 'action' | 'category'>[], navigateToSettings: () => void) {
    this.items = items;
    this.navigateToSettings = navigateToSettings;
  }

  search(query: string): SearchSourceResult[] {
    const q = query.toLowerCase();
    return this.items
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q))
      .map((s) => ({
        ...s,
        category: this.label,
        action: () => this.navigateToSettings(),
      }));
  }
}

export class QuickActionSearchSource implements SearchSource {
  id = 'quickActions';
  label = 'searchPalette.categoryQuickActions';
  priority = 20;

  private actions: Omit<SearchSourceResult, 'action' | 'category'>[];
  private actionHandlers: Record<string, () => void>;

  constructor(actions: Omit<SearchSourceResult, 'action' | 'category'>[], actionHandlers: Record<string, () => void>) {
    this.actions = actions;
    this.actionHandlers = actionHandlers;
  }

  search(query: string): SearchSourceResult[] {
    const q = query.toLowerCase();
    return this.actions
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q))
      .map((a) => ({
        ...a,
        category: this.label,
        action: () => this.actionHandlers[a.id]?.(),
      }));
  }
}

export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;

  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  const exactIndex = t.indexOf(q);
  if (exactIndex !== -1) {
    return 1000 - exactIndex;
  }

  let qi = 0;
  let score = 0;
  let lastMatchIdx = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += lastMatchIdx === ti - 1 ? 10 : 1;
      lastMatchIdx = ti;
      qi++;
    }
  }

  return qi === q.length ? score : -1;
}

const RECENT_SEARCHES_KEY = 'bonnext_recent_searches';
const MAX_RECENT_SEARCHES = 8;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  if (!query.trim()) return;
  try {
    const existing = getRecentSearches().filter((s) => s !== query.trim());
    const updated = [query.trim(), ...existing].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    /* empty */
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    /* empty */
  }
}
