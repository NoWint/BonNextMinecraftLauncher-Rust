import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGitHubReleases } from '../useGitHubReleases';

const mockRelease = {
  tag_name: 'v1.0.0',
  published_at: '2026-06-21T00:00:00Z',
  assets: [
    {
      name: 'BonNext_1.0.0_x64-setup.exe',
      browser_download_url: 'https://example.com/win.exe',
      size: 50000000,
    },
    {
      name: 'BonNext_1.0.0_aarch64.dmg',
      browser_download_url: 'https://example.com/mac.dmg',
      size: 60000000,
    },
    {
      name: 'BonNext_1.0.0_amd64.AppImage',
      browser_download_url: 'https://example.com/linux.AppImage',
      size: 55000000,
    },
  ],
};

describe('useGitHubReleases', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRelease),
    }));
    localStorage.clear();
  });

  it('fetches latest release and parses assets by platform', async () => {
    const { result } = renderHook(() => useGitHubReleases('owner', 'BonNext'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.release?.version).toBe('v1.0.0');
    expect(result.current.release?.assets.windows).toHaveLength(1);
    expect(result.current.release?.assets.macos).toHaveLength(1);
    expect(result.current.release?.assets.linux).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('caches response in localStorage', async () => {
    const { result } = renderHook(() => useGitHubReleases('owner', 'BonNext'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(localStorage.getItem('bonnext-release-cache')).not.toBeNull();
  });

  it('handles fetch errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useGitHubReleases('owner', 'BonNext'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.release).toBeNull();
  });
});
