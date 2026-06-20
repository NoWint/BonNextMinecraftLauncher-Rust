/**
 * Unified playtime formatting helpers shared across shells.
 */

/** Full playtime format: "Xm", "Xh Ym", or "Xd Yh" for very long durations. */
export function formatPlaytime(seconds: number): string {
  if (!seconds || seconds < 60) return '< 1m';
  const totalMinutes = Math.floor(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const remainingH = h % 24;
    return `${d}d ${remainingH}h`;
  }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Short playtime format: only the largest unit ("Xh" or "Xm"). */
export function formatPlaytimeShort(seconds: number): string {
  if (!seconds || seconds < 60) return '< 1m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Today's playtime format: "Xm" or "Xh Ym". */
export function formatTodayPlaytime(seconds: number): string {
  if (!seconds || seconds < 60) return '< 1m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
