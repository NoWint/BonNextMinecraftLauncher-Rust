import type { IconName } from '../components/ui/Icon';

export function formatDate(input: string | Date | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return String(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatPlaytime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0h 0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDownloads(n: number): string {
  return formatNum(n);
}

export function getLoaderIcon(loader: string | null | undefined): IconName {
  if (!loader) return 'vanilla';
  const l = loader.toLowerCase();
  if (l === 'fabric') return 'fabric';
  if (l === 'forge') return 'forge';
  if (l === 'quilt') return 'quilt';
  if (l === 'neoforge') return 'neoforge';
  return 'vanilla';
}

export function getLoaderLabel(loader: string | null | undefined): string {
  if (!loader) return 'Vanilla';
  const l = loader.toLowerCase();
  if (l === 'fabric') return 'Fabric';
  if (l === 'forge') return 'Forge';
  if (l === 'quilt') return 'Quilt';
  if (l === 'neoforge') return 'NeoForge';
  return loader;
}
