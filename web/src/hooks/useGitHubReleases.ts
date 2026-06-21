import { useEffect, useState } from 'react';

export type Platform = 'windows' | 'macos' | 'linux';

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
  platform: Platform;
}

export interface ReleaseInfo {
  version: string;
  publishedAt: string;
  assets: {
    windows: ReleaseAsset[];
    macos: ReleaseAsset[];
    linux: ReleaseAsset[];
  };
}

interface UseGitHubReleasesResult {
  release: ReleaseInfo | null;
  loading: boolean;
  error: Error | null;
}

const CACHE_KEY = 'bonnext-release-cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function detectPlatform(filename: string): Platform {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.exe') || lower.endsWith('.msi') || lower.includes('win')) {
    return 'windows';
  }
  if (lower.endsWith('.dmg') || lower.endsWith('.pkg') || lower.includes('mac') || lower.includes('darwin')) {
    return 'macos';
  }
  if (lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.rpm') || lower.includes('linux')) {
    return 'linux';
  }
  return 'windows';
}

function parseRelease(data: {
  tag_name: string;
  published_at: string;
  assets: Array<{ name: string; browser_download_url: string; size: number }>;
}): ReleaseInfo {
  const assets: ReleaseInfo['assets'] = { windows: [], macos: [], linux: [] };
  for (const a of data.assets) {
    const platform = detectPlatform(a.name);
    const asset: ReleaseAsset = {
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
      platform,
    };
    assets[platform].push(asset);
  }
  return {
    version: data.tag_name,
    publishedAt: data.published_at,
    assets,
  };
}

function detectUserPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'windows';
  if (ua.includes('Mac')) return 'macos';
  if (ua.includes('Linux')) return 'linux';
  return 'windows';
}

export function useGitHubReleases(owner: string, repo: string): UseGitHubReleasesResult {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Try cache first
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            if (!cancelled) {
              setRelease(parsed.data);
              setLoading(false);
            }
            return;
          }
        }
      } catch {
        // ignore cache parse errors
      }

      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        const data = await res.json();
        const parsed = parseRelease(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: parsed, timestamp: Date.now() }));
        } catch {
          // ignore cache write errors
        }
        if (!cancelled) {
          setRelease(parsed);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [owner, repo]);

  return { release, loading, error };
}

export { detectUserPlatform, detectPlatform };
