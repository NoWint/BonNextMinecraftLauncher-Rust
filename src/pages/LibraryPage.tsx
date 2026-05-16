import { useState, useEffect, useCallback } from 'react';
import { api, type ContentCounts, type InstalledModInfo } from '../api';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { SectionHeader, Ticker } from '../components/layout';
import { Button, Modal, Tabs, Select } from '../components/ui';
import { CardSkeleton } from '../components/ui/Skeleton';
import styles from './LibraryPage.module.css';

const TABS = [
  { id: 'mods', label: 'MODS' },
  { id: 'resourcepacks', label: 'RESOURCE PACKS' },
  { id: 'shaders', label: 'SHADERS' },
  { id: 'worlds', label: 'WORLDS' },
];

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function LibraryPage() {
  const { state: instState } = useInstances();
  const { addToast } = useToast();

  const [selectedId, setSelectedId] = useState('');
  const [activeTab, setActiveTab] = useState('mods');
  const [mods, setMods] = useState<InstalledModInfo[]>([]);
  const [resourcepacks, setResourcepacks] = useState<string[]>([]);
  const [shaders, setShaders] = useState<string[]>([]);
  const [counts, setCounts] = useState<ContentCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const instances = instState.instances;
  const selectedInstance = instances.find((i) => i.id === selectedId);

  useEffect(() => {
    if (instances.length > 0 && !selectedId) {
      setSelectedId(instances[0].id);
    }
  }, [instances, selectedId]);

  const loadContent = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const [m, r, s, c] = await Promise.all([
        api.listInstanceMods(selectedId),
        api.listInstanceResourcepacks(selectedId),
        api.listInstanceShaders(selectedId),
        api.getContentCounts(selectedId),
      ]);
      setMods(m);
      setResourcepacks(r);
      setShaders(s);
      setCounts(c);
    } catch (e) {
      console.error('Failed to load library:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handleRemoveMod = async () => {
    if (!removeTarget || !selectedId) return;
    try {
      await api.removeInstalledMod(selectedId, removeTarget);
      addToast({ type: 'success', title: 'Removed', message: removeTarget });
      setRemoveTarget(null);
      loadContent();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Remove failed', message: e?.toString() || '' });
    }
  };

  // Build instance options for Select
  const instanceOptions = instances.map((inst) => ({
    value: inst.id,
    label: `${inst.name} (${inst.version_id})`,
  }));

  return (
    <div className={`page-enter ${styles.page}`}>
      <SectionHeader title="CONTENT LIBRARY" subtitle="Manage installed content per instance" />

      {/* Instance selector */}
      <div className={styles.instanceRow}>
        <span className={styles.instanceRow__label}>INSTANCE</span>
        <Select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          options={[
            { value: '', label: 'Select instance...' },
            ...instanceOptions,
          ]}
        />
      </div>

      {/* Summary */}
      {counts && selectedInstance && (
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCard__value}>{counts.mods}</div>
            <div className={styles.summaryCard__label}>MODS</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCard__value}>{counts.resourcepacks}</div>
            <div className={styles.summaryCard__label}>RESOURCE PACKS</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCard__value}>{counts.shaders}</div>
            <div className={styles.summaryCard__label}>SHADERS</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCard__value}>{counts.worlds}</div>
            <div className={styles.summaryCard__label}>WORLDS</div>
          </div>
        </div>
      )}

      {/* Content type tabs */}
      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {/* Content list */}
      {loading ? (
        <div className={styles.loadingGrid}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : !selectedId ? (
        <div className={styles.empty}>
          <div className={styles.empty__title}>Select an instance</div>
          <div className={styles.empty__desc}>Choose an instance to view its installed content.</div>
        </div>
      ) : (
        <>
          {/* Mods tab */}
          {activeTab === 'mods' && (
            mods.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.empty__title}>No mods installed</div>
                <div className={styles.empty__desc}>Browse the marketplace to install mods.</div>
                <Button variant="secondary" size="sm" onClick={() => (window.location.hash = '#/mods')}>
                  Browse mods
                </Button>
              </div>
            ) : (
              <div className={styles.list}>
                {mods.map((mod) => (
                  <div key={mod.filename} className={styles.item}>
                    <div className={styles.item__icon}>{'\u{1F9F5}'}</div>
                    <div className={styles.item__name}>{mod.filename}</div>
                    <div className={styles.item__meta}>{formatSize(mod.size)}</div>
                    <div className={styles.item__meta}>
                      {mod.installed_at ? new Date(mod.installed_at).toLocaleDateString() : ''}
                    </div>
                    <div className={styles.item__actions}>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRemoveTarget(mod.filename)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Resource packs tab */}
          {activeTab === 'resourcepacks' && (
            resourcepacks.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.empty__title}>No resource packs installed</div>
                <div className={styles.empty__desc}>Browse the marketplace to install resource packs.</div>
              </div>
            ) : (
              <div className={styles.list}>
                {resourcepacks.map((name) => (
                  <div key={name} className={styles.item}>
                    <div className={styles.item__icon}>{'\u{1F3A8}'}</div>
                    <div className={styles.item__name}>{name}</div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Shaders tab */}
          {activeTab === 'shaders' && (
            shaders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.empty__title}>No shaders installed</div>
                <div className={styles.empty__desc}>Browse the marketplace to install shaders.</div>
              </div>
            ) : (
              <div className={styles.list}>
                {shaders.map((name) => (
                  <div key={name} className={styles.item}>
                    <div className={styles.item__icon}>{'\u{2728}'}</div>
                    <div className={styles.item__name}>{name}</div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Worlds tab */}
          {activeTab === 'worlds' && (
            counts && counts.worlds === 0 ? (
              <div className={styles.empty}>
                <div className={styles.empty__title}>No saved worlds</div>
                <div className={styles.empty__desc}>Worlds will appear here when you create or download them.</div>
              </div>
            ) : (
              <div className={styles.empty}>
                <div className={styles.empty__title}>World management</div>
                <div className={styles.empty__desc}>Use the instance folder to manage worlds directly.</div>
                {selectedInstance && (
                  <Button variant="secondary" size="sm" onClick={() => api.openFolder(`${selectedInstance.id}/.minecraft/saves`)}>
                    Open saves folder
                  </Button>
                )}
              </div>
            )
          )}
        </>
      )}

      {/* Remove confirmation */}
      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove mod"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleRemoveMod}>
              Remove
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>
          Are you sure you want to remove <strong>{removeTarget}</strong>?
        </p>
      </Modal>

      <Ticker messages={[
        `Instance: ${selectedInstance?.name || 'None'} · ${selectedInstance?.version_id || 'N/A'}`,
        `Total: ${(counts?.mods || 0) + (counts?.resourcepacks || 0) + (counts?.shaders || 0)} content items`,
        'All content stored in instance .minecraft directory',
      ]} />
    </div>
  );
}
