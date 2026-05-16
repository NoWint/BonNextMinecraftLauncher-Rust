import { useState, useEffect, useCallback } from 'react';
import { api, type GameInstance } from '../api';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { Badge, Tabs, Modal, Breadcrumb as BreadcrumbComp } from '../components/ui';
import { Button } from '../components/ui';
import styles from './InstanceDetailPage.module.css';

const DETAIL_TABS = [
  { id: 'overview', label: '概览' },
  { id: 'mods', label: 'Mods (0)' },
  { id: 'saves', label: '存档' },
  { id: 'logs', label: '日志' },
];

export default function InstanceDetailPage() {
  const { state: authState } = useAuth();
  const { state, deleteInstance } = useInstances();
  const auth = authState.currentUser;
  const [instance, setInstance] = useState<GameInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const instanceId = window.location.hash.replace('#/instances/', '').split('?')[0];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const inst = await api.getInstance(instanceId);
        setInstance(inst);
      } catch {
        const found = state.instances.find((i) => i.id === instanceId);
        setInstance(found || null);
      }
      setLoading(false);
    };
    load();
  }, [instanceId]);

  const handleLaunch = useCallback(async () => {
    if (!instance) return;
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
  }, [instance, auth]);

  const handleDelete = async () => {
    if (!instance) return;
    await deleteInstance(instance.id);
    window.location.hash = '#/instances';
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!instance) {
    return <div className={styles.notFound}>实例未找到</div>;
  }

  const memoryGB = Math.round(instance.max_memory / 1024);
  const playtimeH = (instance.playtime_seconds / 3600).toFixed(1);

  return (
    <div className={`page-enter ${styles.page}`}>
      <BreadcrumbComp
        items={[
          { label: '实例管理', href: '#/instances' },
          { label: instance.name },
        ]}
      />

      {/* Top info bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarIcon}>⛏</div>
        <div className={styles.topBarInfo}>
          <div className={styles.topBarNameRow}>
            <span className={styles.topBarName}>{instance.name.toUpperCase()}</span>
            <Badge variant="accent">{instance.version_id}</Badge>
            {instance.loader_type && <Badge variant="muted">{instance.loader_type}</Badge>}
          </div>
          <div className={styles.topBarMeta}>
            {instance.loader_type && (
              <>
                <span className={styles.topBarMetaText}>
                  {instance.loader_type} {instance.loader_version || ''}
                </span>
                <div className={styles.topBarMetaSep} />
              </>
            )}
            <span className={styles.topBarRam}>{memoryGB}GB</span>
            <div className={styles.topBarMetaSep} />
            <span className={styles.topBarMetaText}>
              最后游玩 {instance.last_played ? new Date(instance.last_played).toLocaleDateString() : '从未'}
            </span>
          </div>
        </div>
        <div className={styles.topBarActions}>
          <Button variant="primary" size="md" onClick={handleLaunch}>▶ 启动</Button>
          <Button variant="secondary" size="sm">⚙ 设置</Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>删除</Button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Tabs */}
      <Tabs tabs={DETAIL_TABS} activeId={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className={styles.tabContent}>
          {/* Left column */}
          <div className={styles.leftCol}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardHeader}>版本信息</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <InfoRow label="Minecraft" value={instance.version_id} />
                <InfoRow label="加载器" value={instance.loader_type ? `${instance.loader_type} ${instance.loader_version || ''}` : 'Vanilla'} />
                <InfoRow label="Java" value={instance.java_path || '自动检测'} />
                <InfoRow label="实例路径" value={`~/BonNext/instances/${instance.id}`} mono />
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoCardHeader}>启动配置</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <InfoRow label="分配内存" value={`${memoryGB} GB`} mono />
                <InfoRow label="窗口分辨率" value="默认" />
                <InfoRow label="全屏" value="否" />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className={styles.rightCol}>
            <div className={styles.statCard}>
              <div className={styles.statCardLabel}>磁盘占用</div>
              <div className={styles.statCardValue}>— GB</div>
              <div className={styles.statBar}>
                <div className={styles.statBarFill} style={{ width: '0%' }} />
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statCardLabel}>游玩时长</div>
              <div className={styles.statCardValue}>{playtimeH} h</div>
              <div className={styles.statCardSub}>
                共 {instance.playtime_seconds > 0 ? '?' : '0'} 次启动
              </div>
            </div>

            <div className={styles.exportBtn}>
              <Button variant="secondary-highlight" size="md" style={{ width: '100%', justifyContent: 'center' }}>
                📤 导出实例
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab !== 'overview' && (
        <div className={styles.placeholderTab}>
          {activeTab === 'mods' && 'Mod 管理功能即将推出'}
          {activeTab === 'saves' && '存档管理功能即将推出'}
          {activeTab === 'logs' && '日志查看功能即将推出'}
        </div>
      )}

      {/* Delete modal */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="确认删除"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>取消</Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>删除</Button>
          </>
        }
      >
        确定要删除实例 "{instance.name}" 吗？此操作不可撤销。
      </Modal>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoRowLabel}>{label}</span>
      <span className={mono ? styles.infoRowValueMono : styles.infoRowValue}>{value}</span>
    </div>
  );
}
