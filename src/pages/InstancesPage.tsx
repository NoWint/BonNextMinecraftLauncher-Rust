import { useState, useCallback, useEffect } from 'react';
import { api, type GameInstance } from '../api';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { useI18n } from '../i18n';
import { SectionHeader } from '../components/layout';
import { Badge, Modal, TextInput, Select, Breadcrumb as BreadcrumbComp, Tooltip } from '../components/ui';
import { Button } from '../components/ui';
import { relativeTime } from '../utils/time';
import styles from './InstancesPage.module.css';

function getLoaderIcon(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric': return '\u{1F9F5}';
    case 'forge': return '\u{2692}';
    default: return '\u{1F4E6}';
  }
}

function getLoaderLabel(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric': return 'Fabric';
    case 'forge': return 'Forge';
    default: return 'Vanilla';
  }
}

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return '< 1m played';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m played`;
  return `${(seconds / 3600).toFixed(1)} hrs played`;
}

export default function InstancesPage() {
  const { state: authState } = useAuth();
  const { state, deleteInstance, reloadInstances } = useInstances();
  const { addToast } = useToast();
  const { t } = useI18n();
  const auth = authState.currentUser;
  const { instances } = state;
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [versionFilter, setVersionFilter] = useState('all');
  const [loaderFilter, setLoaderFilter] = useState('all');
  const [readyStates, setReadyStates] = useState<Record<string, boolean | null>>({});
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [viewMode] = useState<'list' | 'grid'>('grid');

  // Check ready states
  useEffect(() => {
    const checkAll = async () => {
      const states: Record<string, boolean | null> = {};
      for (const inst of instances) {
        try {
          states[inst.id] = await api.checkInstanceReady(inst.id);
        } catch {
          states[inst.id] = null;
        }
      }
      setReadyStates(states);
    };
    if (instances.length > 0) checkAll();
  }, [instances]);

  const handleLaunch = useCallback(async (instance: GameInstance) => {
    setError('');
    try {
      await api.launchGame(
        instance.version_id, instance.version_url,
        auth?.username || 'Player', auth?.uuid || '',
        auth?.access_token || '', instance.max_memory, instance.min_memory,
        instance.java_path || undefined, instance.jvm_args || undefined,
      );
      addToast({ type: 'success', title: 'Launching', message: `${instance.name} is starting...` });
    } catch (e: any) {
      setError(e?.toString() || 'Launch failed');
      addToast({ type: 'error', title: 'Launch failed', message: e?.toString() || 'Launch failed' });
      setTimeout(() => setError(''), 8000);
    }
  }, [auth, addToast]);

  const handleDuplicate = useCallback(async (inst: GameInstance) => {
    setDuplicatingId(inst.id);
    setDuplicateName(`${inst.name} (Copy)`);
  }, []);

  const confirmDuplicate = useCallback(async () => {
    if (!duplicatingId || !duplicateName.trim()) return;
    try {
      await api.duplicateInstance(duplicatingId, duplicateName.trim());
      addToast({ type: 'success', title: 'Duplicated', message: `Instance "${duplicateName}" created` });
      await reloadInstances();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Duplicate failed', message: e?.toString() || 'Failed to duplicate' });
    } finally {
      setDuplicatingId(null);
      setDuplicateName('');
    }
  }, [duplicatingId, duplicateName, reloadInstances, addToast]);

  const handleExport = useCallback(async (inst: GameInstance) => {
    setExportingId(inst.id);
    try {
      // Use a friendly filename
      const defaultName = `${inst.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${inst.version_id}.zip`;
      // Build output path in game dir root
      const gameDir = await api.getGameDir();
      const outputPath = `${gameDir}/${defaultName}`;
      await api.exportInstance(inst.id, outputPath);
      addToast({ type: 'success', title: 'Exported', message: `Saved to ${defaultName}` });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Export failed', message: e?.toString() || 'Failed to export' });
    } finally {
      setExportingId(null);
    }
  }, [addToast]);

  const filtered = instances
    .filter((inst) => !search || inst.name.toLowerCase().includes(search.toLowerCase()))
    .filter((inst) => versionFilter === 'all' || inst.version_id === versionFilter)
    .filter((inst) => loaderFilter === 'all' || inst.loader_type === loaderFilter);

  const uniqueVersions = [...new Set(instances.map((i) => i.version_id))];
  const uniqueLoaders = [...new Set(instances.filter((i) => i.loader_type).map((i) => i.loader_type!))];
  const totalSize = instances.reduce((sum, i) => sum + i.max_memory, 0);

  const renderGridCard = (inst: GameInstance, i: number) => {
    const isReady = readyStates[inst.id] ?? null;
    const loader = inst.loader_type || 'vanilla';
    const coverClass = styles[`cardCover--${loader}`] || styles['cardCover--vanilla'];
    return (
      <div key={inst.id} className={styles.libraryCard} style={{ animationDelay: `${i * 50}ms` }}>
        <div className={`${styles.cardCover} ${coverClass}`}>
          <div className={styles.cardCoverIcon}>{getLoaderIcon(inst.loader_type)}</div>
          <div className={styles.cardPlayOverlay}>
            <button className={styles.cardPlayBtn} onClick={(e) => { e.stopPropagation(); handleLaunch(inst); }} />
          </div>
          <div style={{
            position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%',
            background: isReady === true ? '#4CAF50' : isReady === false ? '#FF9800' : '#444',
            boxShadow: `0 0 6px ${isReady === true ? '#4CAF50' : isReady === false ? '#FF9800' : 'transparent'}`,
          }} />
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardTitle}>{inst.name}</span>
            <Badge variant="accent">{inst.version_id}</Badge>
          </div>
          {inst.loader_type && (
            <div style={{ display: 'flex', gap: 4 }}>
              <Badge variant="muted">{inst.loader_type}{inst.loader_version ? ` ${inst.loader_version}` : ''}</Badge>
            </div>
          )}
          <div className={styles.cardMeta}>
            <span>{relativeTime(inst.last_played)}</span><span className={styles.cardMetaSep} />
            <span>{formatPlaytime(inst.playtime_seconds)}</span><span className={styles.cardMetaSep} />
            <span className={isReady === true ? styles['cardStatus--ready'] : isReady === false ? styles['cardStatus--download'] : styles['cardStatus--unknown']}>{isReady === null ? '...' : isReady ? 'Ready' : 'Download'}</span>
          </div>
          <div className={styles.cardActionRow}>
            <Button variant="primary" size="sm" onClick={() => handleLaunch(inst)}>▶ Play</Button>
            <Button variant="icon" onClick={() => window.location.hash = `#/instances/${inst.id}`}>⚙</Button>
            <Button variant="icon" onClick={() => handleDuplicate(inst)}>📋</Button>
            <Button variant="icon" onClick={() => setConfirmDelete(inst.id)}>🗑</Button>
          </div>
        </div>
      </div>
    );
  };

  const renderListView = () => (
    <div className={`${styles.list} stagger-children`}>
      {filtered.map((inst, i) => {
        const isReady = readyStates[inst.id] ?? null;
        return (
          <div key={inst.id} className={`${styles.card} ${i === 0 ? styles.cardFirst : styles.cardDefault}`}>
            {i === 0 && <div className={styles.cardAccent} />}
            <Tooltip content={`${getLoaderLabel(inst.loader_type)}${inst.loader_version ? ` ${inst.loader_version}` : ''}`}>
              <div className={`${styles.cardIcon} ${i === 0 ? styles.cardIconFirst : styles.cardIconDefault}`}>{getLoaderIcon(inst.loader_type)}</div>
            </Tooltip>
            <div className={styles.cardInfo}>
              <div className={styles.cardNameRow}>
                <span className={`${styles.cardName} ${i === 0 ? styles.cardNameFirst : styles.cardNameDefault}`}>{inst.name}</span>
                <Badge variant="accent">{inst.version_id}</Badge>
                {inst.loader_type && <Badge variant="muted">{inst.loader_type}</Badge>}
              </div>
              <div className={styles.cardMeta}>
                <span>Last played: {relativeTime(inst.last_played)}</span><span className={styles.cardMetaSep}>.</span>
                <span>{formatPlaytime(inst.playtime_seconds)}</span><span className={styles.cardMetaSep}>.</span>
                <span className={isReady === true ? styles.readyStatus : isReady === false ? styles.needsDownloadStatus : styles.unknownStatus}>{isReady === null ? 'Checking...' : isReady ? 'Ready' : 'Download'}</span>
              </div>
            </div>
            <div className={styles.cardActions}>
              <Button variant="primary" size="sm" onClick={() => handleLaunch(inst)}>▶ Launch</Button>
              <Button variant="icon" onClick={() => window.location.hash = `#/instances/${inst.id}`}>⚙</Button>
              <Button variant="icon" onClick={() => handleDuplicate(inst)}>📋</Button>
              <Button variant="icon" onClick={() => handleExport(inst)} disabled={exportingId === inst.id}>{exportingId === inst.id ? '⏳' : '📤'}</Button>
              <Button variant="icon" onClick={() => setConfirmDelete(inst.id)}>🗑</Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`page-enter ${styles.page}`}>
      <BreadcrumbComp
        items={[
          { label: t('instances.title'), href: '#/instances' },
          { label: t('instances.allInstances') },
        ]}
      />

      {/* Header */}
      <div className={styles.header}>
        <div>
          <SectionHeader
            title={t('instances.allInstances').toUpperCase()}
            subtitle={`${instances.length} ${t('home.instances')} · ${(totalSize / 1024).toFixed(1)} ${t('common.unit.gb')}`}
          />
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => window.location.hash = '#/instances/new'}>
            + {t('instances.create')}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearch}>
          <TextInput
            placeholder={t('instances.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filterSelect}>
          <Select
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
            options={[
              { value: 'all', label: t('instances.filterVersion') },
              ...uniqueVersions.map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
        <div className={styles.filterSelect}>
          <Select
            value={loaderFilter}
            onChange={(e) => setLoaderFilter(e.target.value)}
            options={[
              { value: 'all', label: t('instances.filterLoader') },
              { value: '', label: t('common.vanilla') },
              ...uniqueLoaders.map((l) => ({ value: l, label: l })),
            ]}
          />
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Instance cards */}
      {instances.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyBar} />
          <div className={styles.emptyTitle}>{t('instances.noInstances')}</div>
          <div className={styles.emptyDesc}>{t('instances.noInstancesDesc')}</div>
          <Button variant="primary" size="md" onClick={() => window.location.hash = '#/instances/new'}>
            + {t('instances.create')}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.noMatch}>{t('instances.noMatch')}</div>
      ) : viewMode === 'grid' ? (
        <div className={styles.libraryGrid}>
          {filtered.map((inst, i) => renderGridCard(inst, i))}
        </div>
      ) : (
        renderListView()
      )}
      {/* Delete confirmation modal */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t('instances.deleteTitle')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" size="sm" onClick={async () => {
              if (confirmDelete) await deleteInstance(confirmDelete);
              setConfirmDelete(null);
            }}>{t('common.delete')}</Button>
          </>
        }
      >
        {t('instances.deleteConfirm')}
      </Modal>

      {/* Duplicate modal */}
      <Modal
        open={duplicatingId !== null}
        onClose={() => { setDuplicatingId(null); setDuplicateName(''); }}
        title="Duplicate Instance"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setDuplicatingId(null); setDuplicateName(''); }}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={confirmDuplicate} disabled={!duplicateName.trim()}>
              Duplicate
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>New instance name:</label>
          <TextInput
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
            placeholder="Instance name"
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
