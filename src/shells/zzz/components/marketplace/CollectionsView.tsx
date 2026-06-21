/**
 * CollectionsView - 收藏列表视图
 *
 * 从 CollectionsPage 提取的可嵌入组件，用于 VersionsPage 下载中心的收藏标签页。
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type CollectionItem } from '../../../../shared/api';
import { useI18n } from '../../../../shared/i18n';
import { useToast } from '../../../../shared/stores/toastStore';
import { logger } from '../../../../shared/utils/logger';
import { Button, ContentCard, Tabs } from '../ui';
import { Icon } from '../ui/Icon';
import { CardSkeleton } from '../ui/Skeleton';
import { useSkeleton } from '../../../../shared/hooks/useSkeleton';

interface CollectionsViewProps {
  /** 是否显示 SectionHeader，嵌入下载中心时设为 false */
  showHeader?: boolean;
}

export default function CollectionsView({ showHeader = false }: CollectionsViewProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { addToast } = useToast();
  const TYPE_TABS = [
    { id: 'all', label: t('versions.all') },
    { id: 'mod', label: t('instanceDetail.mods') },
    { id: 'modpack', label: t('versions.tabModpack') },
    { id: 'resourcepack', label: t('versions.tabResourcePack') },
    { id: 'shader', label: t('versions.tabShader') },
  ];
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { showSkeleton } = useSkeleton({ loading, minDuration: 300 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listCollection());
    } catch (e) {
      logger.error('Failed to load collections:', e);
      addToast({ type: 'error', title: t('collections.loadFailed') });
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.content_type === filter);

  return (
    <>
      {showHeader && (
        <div style={{ fontSize: '0.7em', color: 'var(--color-text-dim)', marginBottom: 8 }}>
          {items.length} {t('common.installed')}
        </div>
      )}

      <Tabs tabs={TYPE_TABS} activeId={filter} onChange={setFilter} />

      {showSkeleton ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '48px 24px', color: 'var(--color-text-dim)' }}>
          <Icon name="heart" size={48} />
          <div style={{ fontSize: '0.7em', color: 'var(--color-text)' }}>
            {items.length === 0 ? t('collections.empty') : t('instances.noMatch')}
          </div>
          <div style={{ fontSize: '0.55em', textAlign: 'center', maxWidth: 320 }}>
            {items.length === 0 ? t('collections.emptyDesc') : t('collections.tryDifferent')}
          </div>
          {items.length === 0 && (
            <Button variant="primary" size="md" onClick={() => navigate('/versions')}>
              {t('collections.browseMarketplace')}
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
          {filtered.map((content) => (
            <ContentCard
              key={content.slug}
              content={{
                slug: content.slug,
                title: content.title,
                description: content.description,
                author: content.author,
                icon_url: content.icon_url,
                categories: content.categories,
                downloads: content.downloads,
                latest_version: null,
                date_modified: content.added_at,
                project_type: content.content_type,
              }}
              variant="list"
              onNavigate={(slug) => {
                navigate(`/store/${content.content_type}/${slug}`);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
