import { useState, useCallback } from 'react';
import { api, type GameInstance } from '../api';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { SectionHeader } from '../components/layout';
import { Badge, Modal, TextInput, Select, Breadcrumb as BreadcrumbComp } from '../components/ui';
import { Button } from '../components/ui';
import styles from './InstancesPage.module.css';

export default function InstancesPage() {
  const { state: authState } = useAuth();
  const { state, deleteInstance } = useInstances();
  const auth = authState.currentUser;
  const { instances } = state;
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [versionFilter, setVersionFilter] = useState('all');
  const [loaderFilter, setLoaderFilter] = useState('all');

  const handleLaunch = useCallback(async (instance: GameInstance) => {
    setError('');
    try {
      await api.launchGame(
        instance.version_id, instance.version_url,
        auth?.username || 'Player', auth?.uuid || '',
        auth?.access_token || '', instance.max_memory, instance.min_memory,
        instance.java_path || undefined, instance.jvm_args || undefined,
      );
    } catch (e: any) {
      setError(e?.toString() || 'Launch failed');
      setTimeout(() => setError(''), 8000);
    }
  }, [auth]);

  const filtered = instances
    .filter((inst) => !search || inst.name.toLowerCase().includes(search.toLowerCase()))
    .filter((inst) => versionFilter === 'all' || inst.version_id === versionFilter)
    .filter((inst) => loaderFilter === 'all' || inst.loader_type === loaderFilter);

  const uniqueVersions = [...new Set(instances.map((i) => i.version_id))];
  const uniqueLoaders = [...new Set(instances.filter((i) => i.loader_type).map((i) => i.loader_type!))];
  const totalSize = instances.reduce((sum, i) => sum + i.max_memory, 0);

  return (
    <div className={`page-enter ${styles.page}`}>
      <BreadcrumbComp
        items={[
          { label: '实例管理', href: '#/instances' },
          { label: '全部实例' },
        ]}
      />

      {/* Header */}
      <div className={styles.header}>
        <div>
          <SectionHeader
            title="所有实例"
            subtitle={`${instances.length} 个实例 · 总计占用 ${(totalSize / 1024).toFixed(1)} GB`}
          />
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm">📂 导入</Button>
          <Button variant="secondary-highlight" size="sm">📤 导出</Button>
          <Button variant="primary" size="md" onClick={() => window.location.hash = '#/instances/new'}>
            + 新建实例
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearch}>
          <TextInput
            placeholder="搜索实例..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filterSelect}>
          <Select
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
            options={[
              { value: 'all', label: '全部版本' },
              ...uniqueVersions.map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
        <div className={styles.filterSelect}>
          <Select
            value={loaderFilter}
            onChange={(e) => setLoaderFilter(e.target.value)}
            options={[
              { value: 'all', label: '全部加载器' },
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
          <div className={styles.emptyTitle}>还没有实例</div>
          <div className={styles.emptyDesc}>创建第一个 Minecraft 实例开始游戏</div>
          <Button variant="primary" size="md" onClick={() => window.location.hash = '#/instances/new'}>
            + 新建实例
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.noMatch}>没有匹配的实例</div>
      ) : (
        <div className={`${styles.list} stagger-children`}>
          {filtered.map((inst, i) => (
            <div
              key={inst.id}
              className={`${styles.card} ${i === 0 ? styles.cardFirst : styles.cardDefault}`}
            >
              {i === 0 && <div className={styles.cardAccent} />}
              <div className={`${styles.cardIcon} ${i === 0 ? styles.cardIconFirst : styles.cardIconDefault}`}>
                ⛏
              </div>
              <div className={styles.cardInfo}>
                <div className={styles.cardNameRow}>
                  <span className={`${styles.cardName} ${i === 0 ? styles.cardNameFirst : styles.cardNameDefault}`}>
                    {inst.name}
                  </span>
                  <Badge variant="accent">{inst.version_id}</Badge>
                  {inst.loader_type && <Badge variant="muted">{inst.loader_type}</Badge>}
                </div>
                <div className={styles.cardMeta}>
                  {inst.description || `最后游玩 ${inst.last_played || '从未'} · ${Math.round(inst.max_memory / 1024)}GB RAM`}
                </div>
              </div>
              <div className={styles.cardActions}>
                <Button variant="primary" size="sm" onClick={() => handleLaunch(inst)}>
                  ▶ 启动
                </Button>
                <Button variant="icon" onClick={() => window.location.hash = `#/instances/${inst.id}`}>
                  ⚙
                </Button>
                <Button variant="icon" onClick={() => setConfirmDelete(inst.id)}>
                  ⋯
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="确认删除"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>取消</Button>
            <Button variant="danger" size="sm" onClick={async () => {
              if (confirmDelete) await deleteInstance(confirmDelete);
              setConfirmDelete(null);
            }}>删除</Button>
          </>
        }
      >
        确定要删除此实例吗？此操作不可撤销，实例文件将被永久删除。
      </Modal>
    </div>
  );
}
