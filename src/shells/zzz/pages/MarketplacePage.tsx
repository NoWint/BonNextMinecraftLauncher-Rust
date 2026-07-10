import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useI18n } from '../../../shared/i18n';
import { SectionHeader } from '../components/layout';
import { Icon } from '../components/ui/Icon';
import ContentBrowser from '../components/marketplace/ContentBrowser';
import CollectionsView from '../components/marketplace/CollectionsView';
import styles from './MarketplacePage.module.css';

// 模组市场页：从原"下载中心"拆分而来，专注在线内容浏览与安装。
// 游戏版本下载与整合包导入留在 /versions；已安装内容管理在 /library。
type MarketTab = 'mod' | 'resourcepack' | 'shader' | 'world' | 'collections';

export default function MarketplacePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state: instanceState } = useInstances();
  const [activeTab, setActiveTab] = useState<MarketTab>('mod');

  const hasInstances = instanceState.instances.length > 0;

  const sidebarItems: { id: MarketTab; label: string; icon: string }[] = [
    { id: 'mod', label: t('versions.tabMod'), icon: 'puzzle' },
    { id: 'resourcepack', label: t('versions.tabResourcePack'), icon: 'palette' },
    { id: 'shader', label: t('versions.tabShader'), icon: 'sun' },
    { id: 'world', label: t('versions.tabWorld'), icon: 'globe' },
    { id: 'collections', label: t('sidebar.collections'), icon: 'heart' },
  ];

  const isContentTab = activeTab !== 'collections';

  return (
    <div className={styles.marketplace}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarCategory}>
          <div className={styles.sidebarCategoryTitle}>{t('versions.catContent')}</div>
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              className={`${styles.sidebarItem} ${activeTab === item.id ? styles.sidebarItemActive : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon name={item.icon as never} size={14} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className={styles.content}>
        {isContentTab && !hasInstances && (
          <div className={styles.emptyHint}>
            <SectionHeader title={t('marketplace.title').toUpperCase()} subtitle={t('marketplace.needInstance')} />
            <button className={styles.emptyHint__btn} onClick={() => navigate('/instances/new')}>
              + {t('home.newInstance')}
            </button>
          </div>
        )}

        {activeTab === 'mod' && hasInstances && <ContentBrowser contentType="mod" />}
        {activeTab === 'resourcepack' && hasInstances && <ContentBrowser contentType="resourcepack" />}
        {activeTab === 'shader' && hasInstances && <ContentBrowser contentType="shader" />}
        {activeTab === 'world' && hasInstances && <ContentBrowser contentType="datapack" />}

        {activeTab === 'collections' && <CollectionsView showHeader />}
      </div>
    </div>
  );
}
