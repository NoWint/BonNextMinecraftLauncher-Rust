/**
 * Unified playtime formatting helpers shared across shells.
 */

/** Full playtime format: 'Xm', 'Xh Ym', or 'Xd Yh' for very long durations.
 *  Optionally appends a suffix (e.g. 'played'). */
export function formatPlaytime(seconds: number, suffix?: string): string {
  if (!seconds || seconds < 60) return suffix ? `< 1m ${suffix}` : '< 1m';
  const totalMinutes = Math.floor(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  let result: string;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const remainingH = h % 24;
    result = `${d}d ${remainingH}h`;
  } else if (h > 0) {
    result = `${h}h ${m}m`;
  } else {
    result = `${m}m`;
  }
  return suffix ? `${result} ${suffix}` : result;
}

/** Short playtime format: 'Xm' or 'Xh Ym'. */
export function formatPlaytimeShort(seconds: number): string {
  if (!seconds || seconds < 60) return '< 1m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Compact playtime format: '< 1m', 'Xm', or 'X.Xh'. */
export function formatPlaytimeCompact(seconds: number): string {
  if (!seconds || seconds < 60) return '< 1m';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/** Today's playtime format: always 'Xh Ym' (e.g. '0h 30m'). */
export function formatTodayPlaytime(seconds: number): string {
  if (!seconds || seconds < 60) return '< 1m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
