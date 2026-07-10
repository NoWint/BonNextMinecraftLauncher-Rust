import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatError } from '../../../shared/utils/errorMapping';
import { api, type VersionEntry } from '../../../shared/api';
import { useToast } from '../../../shared/stores/toastStore';
import { useI18n } from '../../../shared/i18n';
import { SectionHeader } from '../components/layout';
import { Badge, Button, Select, TextInput } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { Skeleton } from '../components/ui/Skeleton';
import { useSkeleton } from '../../../shared/hooks/useSkeleton';
import { open } from '@tauri-apps/plugin-dialog';
import ContentBrowser from '../components/marketplace/ContentBrowser';
import styles from './VersionsPage.module.css';

// 下载中心：仅游戏版本下载 + 整合包导入。
// 模组/资源包/光影/世界/收藏 已迁至独立 /mods 模组市场页；
// 已安装内容管理已迁至独立 /library 内容库页。
type DownloadTab = 'game' | 'modpack';

export default function VersionsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<DownloadTab>('game');

  // 游戏版本下载状态
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'release' | 'snapshot' | 'all'>('release');
  const [versionSearch, setVersionSearch] = useState('');
  const { showSkeleton } = useSkeleton({ loading, minDuration: 300 });

  // 整合包导入状态
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    setLoading(true);
    setError('');
    try {
      const v = await api.getVersions();
      setVersions(v);
    } catch (e: unknown) {
      const msg = formatError(e) || t('versions.loadFailed');
      setError(msg);
      addToast({ type: 'error', title: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (v: VersionEntry) => {
    setDownloading(v.id);
    setError('');
    try {
      await api.downloadVersion(v.id, v.url);
      addToast({ type: 'success', title: t('versions.downloadSuccess', { version: v.id }) });
    } catch (e: unknown) {
      const msg = formatError(e) || t('versions.downloadFailed');
      setError(msg);
      addToast({ type: 'error', title: msg });
    } finally {
      setDownloading(null);
    }
  };

  const handleImportModpack = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Modpack', extensions: ['mrpack', 'zip'] },
        ],
      });
      if (selected && typeof selected === 'string') {
        setImporting(true);
        const inst = await api.importModpack(selected);
        addToast({ type: 'success', title: t('versions.modpackImportSuccess', { name: inst.name }) });
        navigate(`/instances/${inst.id}`);
      }
    } catch (e: unknown) {
      const msg = formatError(e) || t('versions.modpackImportFailed');
      setError(msg);
      addToast({ type: 'error', title: msg });
    } finally {
      setImporting(false);
    }
  }, [navigate, addToast, t]);

  // 版本过滤 + 搜索
  const filtered = useMemo(() => {
    let result = filter === 'all' ? versions : versions.filter((v) => v.type === filter);
    if (versionSearch.trim()) {
      const q = versionSearch.toLowerCase();
      result = result.filter((v) => v.id.toLowerCase().includes(q));
    }
    return result;
  }, [versions, filter, versionSearch]);

  const sidebarCategories = [
    {
      category: t('versions.catGame'),
      items: [
        { id: 'game' as DownloadTab, label: t('versions.tabGame'), icon: 'cube' as const },
        { id: 'modpack' as DownloadTab, label: t('versions.tabModpack'), icon: 'puzzle' as const },
      ],
    },
  ];

  return (
    <div className={styles.downloadCenter}>
      <aside className={styles.sidebar}>
        {sidebarCategories.map((cat) => (
          <div key={cat.category} className={styles.sidebarCategory}>
            <div className={styles.sidebarCategoryTitle}>{cat.category}</div>
            {cat.items.map((item) => (
              <button
                key={item.id}
                className={`${styles.sidebarItem} ${activeTab === item.id ? styles.sidebarItemActive : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon name={item.icon} size={14} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <div className={styles.content}>
        {activeTab === 'game' && (
          <>
            <SectionHeader title={t('versions.title').toUpperCase()} subtitle={`${versions.length} ${t('versions.count')}`} />
            <div className={styles.controls}>
              <TextInput
                placeholder={t('instances.filter')}
                value={versionSearch}
                onChange={(e) => setVersionSearch(e.target.value)}
              />
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'release' | 'snapshot' | 'all')}
                options={[
                  { value: 'release', label: t('versions.release') },
                  { value: 'snapshot', label: t('versions.snapshot') },
                  { value: 'all', label: t('versions.all') },
                ]}
              />
              <Button variant="secondary" size="sm" onClick={loadVersions} disabled={loading}>
                {loading ? t('versions.loading') : t('versions.refresh')}
              </Button>
            </div>
            {error && <div className={styles.error}>{error}</div>}
            {showSkeleton ? (
              <div className={`${styles.grid} stagger-children`}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className={styles.card}>
                    <div className={styles.card__header}>
                      <Skeleton variant="icon" />
                      <Skeleton variant="text" width="50px" />
                    </div>
                    <Skeleton variant="title" />
                    <Skeleton variant="text" width="40%" />
                    <Skeleton variant="text" width="80px" style={{ marginTop: 'auto' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${styles.grid} stagger-children`}>
                {filtered.map((v) => (
                  <div key={v.id} className={`${styles.card} card-glow-hover`}>
                    <div className={styles.card__header}>
                      <div
                        className={`${styles.card__icon} ${v.type === 'release' ? styles['card__icon--release'] : styles['card__icon--snapshot']}`}
                      >
                        <Icon name={v.type === 'release' ? 'cube' : 'bolt'} size={14} />
                      </div>
                      <Badge variant={v.type === 'release' ? 'accent' : 'default'}>
                        {v.type === 'release' ? t('versions.releaseBadge') : t('versions.snapshotBadge')}
                      </Badge>
                    </div>
                    <div className={styles.card__version}>{v.id}</div>
                    <div className={styles.card__meta}>
                      <span className={styles.card__type}>{v.type === 'release' ? 'Release' : 'Snapshot'}</span>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={downloading !== null}
                      onClick={() => handleDownload(v)}
                      className={styles.card__btn}
                    >
                      {downloading === v.id ? t('versions.downloading') : t('versions.download')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'modpack' && (
          <>
            <SectionHeader title={t('versions.tabModpack').toUpperCase()} subtitle={t('versions.modpackHint')} />
            {/* 本地整合包导入区 */}
            <div className={styles.importZone}>
              <Icon name="upload" size={32} />
              <p className={styles.importText}>{t('versions.modpackDragHint')}</p>
              <Button variant="primary" size="md" onClick={handleImportModpack} disabled={importing}>
                {importing ? <><Icon name="hourglass" size={14} /> {t('versions.importing')}</> : <><Icon name="download" size={14} /> {t('versions.selectModpack')}</>}
              </Button>
              {error && <div className={styles.error}>{error}</div>}
            </div>
            {/* 在线整合包浏览（HMCL 风格：本地导入 + 在线浏览合一） */}
            <ContentBrowser contentType="modpack" showSubViewSwitch={false} />
          </>
        )}
      </div>
    </div>
  );
}
