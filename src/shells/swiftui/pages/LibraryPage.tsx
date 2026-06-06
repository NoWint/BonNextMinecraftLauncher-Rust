import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../shared/api';
import type { InstalledModInfo, WorldInfo, ContentCounts, UpdateInfo } from '../../../shared/api/types';
import type { ScanResult } from '../../../shared/api/modScanner';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useToast } from '../../../shared/stores/toastStore';
import { InstanceSelect, ContentCard } from '../components/features';
import { Button, Tabs, Spinner } from '../components/ui';
import { RefreshIcon, SearchIcon } from '../components/icons';
import styles from './LibraryPage.module.css';

type TabId = 'mods' | 'resourcepacks' | 'shaders' | 'worlds';

export default function LibraryPage() {
  const { state } = useInstances();
  const { addToast } = useToast();
  const [selectedId, setSelectedId] = useState(state.instances[0]?.id);
  const [counts, setCounts] = useState<ContentCounts | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('mods');
  const [items, setItems] = useState<InstalledModInfo[] | string[] | WorldInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);

  const loadCounts = useCallback(async (instanceId: string) => {
    try {
      const c = await api.getContentCounts(instanceId);
      setCounts(c);
    } catch {
      setCounts(null);
    }
  }, []);

  const loadTabContent = useCallback(async (instanceId: string, tab: TabId) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'mods': {
          const mods = await api.listInstanceMods(instanceId);
          setItems(mods);
          break;
        }
        case 'resourcepacks': {
          const packs = await api.listInstanceResourcepacks(instanceId);
          setItems(packs);
          break;
        }
        case 'shaders': {
          const shaders = await api.listInstanceShaders(instanceId);
          setItems(shaders);
          break;
        }
        case 'worlds': {
          const worlds = await api.listInstanceSaves(instanceId);
          setItems(worlds);
          break;
        }
      }
    } catch (e) {
      console.error('Failed to load content:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadCounts(selectedId);
      loadTabContent(selectedId, activeTab);
    }
  }, [selectedId, activeTab, loadCounts, loadTabContent]);

  const handleScanMods = async () => {
    if (!selectedId) return;
    setScanning(true);
    try {
      const results: ScanResult[] = await api.modScanner.scanModsDirectory(selectedId);
      addToast({ type: 'success', title: 'Scan complete', message: `Identified ${results.filter((r) => r.project_slug).length} of ${results.length} mods` });
      await loadTabContent(selectedId, activeTab);
    } catch (e) {
      addToast({ type: 'error', title: 'Scan failed', message: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setScanning(false);
    }
  };

  const handleCheckUpdates = async () => {
    if (!selectedId) return;
    setCheckingUpdates(true);
    try {
      const result = await api.checkContentUpdates(selectedId);
      setUpdates(result);
      if (result.length === 0) {
        addToast({ type: 'info', title: 'No updates available' });
      } else {
        addToast({ type: 'info', title: 'Updates available', message: `${result.length} content items can be updated` });
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Update check failed', message: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleInstanceChange = (id: string) => {
    setSelectedId(id);
    setActiveTab('mods');
    setCounts(null);
    setItems([]);
    setUpdates([]);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles.empty}>
          <Spinner size="medium" />
          <p style={{ marginTop: 'var(--swift-spacing-md)' }}>Loading content...</p>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className={styles.empty}>
          <p>No {activeTab} found for this instance.</p>
        </div>
      );
    }

    if (activeTab === 'mods') {
      return (
        <div className={styles.grid}>
          {(items as InstalledModInfo[]).map((mod) => (
            <ContentCard
              key={mod.filename}
              title={mod.slug || mod.filename}
              description={`${mod.enabled ? 'Enabled' : 'Disabled'}${mod.pinned ? ' · Pinned' : ''}${mod.source ? ` · ${mod.source}` : ''}`}
              variant="list"
            />
          ))}
        </div>
      );
    }

    if (activeTab === 'worlds') {
      return (
        <div className={styles.grid}>
          {(items as WorldInfo[]).map((world) => (
            <ContentCard
              key={world.name}
              title={world.level_name || world.name}
              description={`${world.game_mode_name || world.game_mode} · ${world.size_mb.toFixed(1)} MB${world.last_played ? ` · Last played ${new Date(world.last_played).toLocaleDateString()}` : ''}`}
              variant="list"
            />
          ))}
        </div>
      );
    }

    // resourcepacks / shaders — string arrays
    return (
      <div className={styles.grid}>
        {(items as string[]).map((name) => (
          <ContentCard
            key={name}
            title={name}
            variant="list"
          />
        ))}
      </div>
    );
  };

  const tabCounts = counts
    ? { mods: counts.mods, resourcepacks: counts.resourcepacks, shaders: counts.shaders, worlds: counts.worlds }
    : { mods: 0, resourcepacks: 0, shaders: 0, worlds: 0 };

  const tabs = [
    { id: 'mods', label: `Mods (${tabCounts.mods})` },
    { id: 'resourcepacks', label: `Packs (${tabCounts.resourcepacks})` },
    { id: 'shaders', label: `Shaders (${tabCounts.shaders})` },
    { id: 'worlds', label: `Worlds (${tabCounts.worlds})` },
  ];

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Library</h1>
      <p className="swiftui-page-subtitle">Installed content per instance</p>
      <div style={{ marginBottom: 'var(--swift-spacing-lg)', display: 'flex', gap: 'var(--swift-spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
        <InstanceSelect instances={state.instances} selectedId={selectedId} onSelect={handleInstanceChange} />
        {selectedId && activeTab === 'mods' && (
          <>
            <Button variant="secondary" size="small" onClick={handleScanMods} disabled={scanning}>
              <SearchIcon size={12} />
              {scanning ? 'Scanning...' : 'Scan Mods'}
            </Button>
            <Button variant="secondary" size="small" onClick={handleCheckUpdates} disabled={checkingUpdates}>
              <RefreshIcon size={12} />
              {checkingUpdates ? 'Checking...' : 'Check Updates'}
            </Button>
          </>
        )}
      </div>
      {selectedId ? (
        <>
          <Tabs tabs={tabs} defaultTab="mods" onChange={(id) => setActiveTab(id as TabId)} />
          <div style={{ marginTop: 'var(--swift-spacing-md)' }}>{renderContent()}</div>
        </>
      ) : (
        <div className={styles.empty}>Select an instance to view its library</div>
      )}
      {updates.length > 0 && (
        <div style={{ marginTop: 'var(--swift-spacing-lg)' }}>
          <h2 className="swiftui-section-title">Available Updates ({updates.length})</h2>
          <div className={styles.grid}>
            {updates.map((u) => (
              <ContentCard
                key={u.slug || u.filename}
                title={u.slug || u.filename}
                description={`${u.installed_version || 'unknown'} → ${u.latest_version}`}
                variant="list"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
