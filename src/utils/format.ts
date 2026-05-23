export function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
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

export function getLoaderIcon(loader: string | null | undefined): string {
  if (!loader) return '📦';
  const l = loader.toLowerCase();
  if (l === 'fabric') return '🧵';
  if (l === 'forge') return '🔨';
  if (l === 'quilt') return '🪡';
  if (l === 'neoforge') return '⚡';
  return '📦';
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
