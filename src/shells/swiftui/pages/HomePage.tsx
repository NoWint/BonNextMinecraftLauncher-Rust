import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/api';
import { useAuth } from '../../../shared/stores/authStore';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useToast } from '../../../shared/stores/toastStore';
import { Button } from '../components/ui';
import { LaunchIcon, PlusIcon, ChevronIcon } from '../components/icons';
import styles from './HomePage.module.css';

export default function HomePage() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [counts, setCounts] = useState<Record<string, { mods: number; shaders: number }>>({});
  const [launching, setLaunching] = useState<string | null>(null);
  const [skinUrl, setSkinUrl] = useState<string | null>(null);
  const [skinModel, setSkinModel] = useState<'default' | 'slim'>('default');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<unknown>(null);

  const username = authState.currentUser?.username;

  // Load skin from active account's local_skin_path (same approach as ZZZ shell)
  useEffect(() => {
    const loadSkin = async () => {
      try {
        const account = await api.getActiveAccount();
        if (account?.local_skin_path) {
          try {
            const b64 = await api.readSkinFile(account.local_skin_path);
            setSkinUrl(b64);
            setSkinModel(account.local_skin_model === 'slim' ? 'slim' : 'default');
            return;
          } catch { /* fallback to Crafatar */ }
        }
      } catch { /* no active account */ }
      // Fallback: Crafatar body render
      if (authState.currentUser?.uuid) {
        const cleanUuid = authState.currentUser.uuid.replace(/-/g, '');
        setSkinUrl(`https://crafatar.com/renders/body/${cleanUuid}?overlay&scale=6`);
        setSkinModel('default');
      }
    };
    loadSkin();
  }, [authState.currentUser]);

  // Initialize skinview3d
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !skinUrl) return;

    let disposed = false;
    (async () => {
      try {
        const { SkinViewer, IdleAnimation } = await import('skinview3d');
        if (disposed) return;

        // Dispose previous viewer
        if (viewerRef.current && typeof (viewerRef.current as { dispose: () => void }).dispose === 'function') {
          (viewerRef.current as { dispose: () => void }).dispose();
        }

        const viewer = new SkinViewer({
          canvas,
          width: 160,
          height: 260,
          enableControls: false,
        });
        viewer.renderer.setClearColor(0x000000, 0);
        viewer.animation = new IdleAnimation();
        viewer.autoRotate = true;
        viewer.autoRotateSpeed = 0.5;

        const model = skinModel;
        // If skinUrl is a base64 data URL (from readSkinFile), load as raw skin
        if (skinUrl.startsWith('data:')) {
          viewer.loadSkin(skinUrl, { model }).catch(() => {});
        } else {
          // Crafatar render — just show as image, not loadSkin
          // For Crafatar renders, we can't use loadSkin (it expects raw skin PNG)
          // Reset and use the image approach instead
          viewer.resetSkin();
        }

        viewerRef.current = viewer;
      } catch {
        // skinview3d not available, fallback to img
      }
    })();

    return () => {
      disposed = true;
      if (viewerRef.current && typeof (viewerRef.current as { dispose: () => void }).dispose === 'function') {
        (viewerRef.current as { dispose: () => void }).dispose();
        viewerRef.current = null;
      }
    };
  }, [skinUrl, skinModel]);

  // Sort instances: last played first, then by name
  const sortedInstances = useMemo(() => {
    return [...instState.instances].sort((a, b) => {
      if (a.last_played && b.last_played) return new Date(b.last_played).getTime() - new Date(a.last_played).getTime();
      if (a.last_played) return -1;
      if (b.last_played) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [instState.instances]);

  // Load content counts for each instance
  useEffect(() => {
    const loadCounts = async () => {
      const result: Record<string, { mods: number; shaders: number }> = {};
      await Promise.all(
        instState.instances.map(async (inst) => {
          try {
            const c = await api.getContentCounts(inst.id);
            result[inst.id] = { mods: c.mods, shaders: c.shaders };
          } catch {
            result[inst.id] = { mods: 0, shaders: 0 };
          }
        }),
      );
      setCounts(result);
    };
    if (instState.instances.length > 0) loadCounts();
  }, [instState.instances]);

  const totalPlaytime = useMemo(
    () => Math.round(instState.instances.reduce((sum, i) => sum + (i.playtime_seconds || 0), 0) / 3600),
    [instState.instances],
  );

  const totalMods = useMemo(
    () => Object.values(counts).reduce((sum, c) => sum + c.mods, 0),
    [counts],
  );

  const handleLaunch = useCallback(async (instId: string) => {
    const inst = instState.instances.find((i) => i.id === instId);
    if (!inst || !authState.currentUser) return;
    setLaunching(instId);
    try {
      await api.launchGame(
        inst.version_id, inst.version_url,
        authState.currentUser.username, authState.currentUser.uuid, authState.currentUser.access_token,
        inst.max_memory, inst.min_memory,
        inst.java_path || undefined, inst.jvm_args || undefined, inst.id,
      );
    } catch (e) {
      addToast({ type: 'error', title: 'Launch failed', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLaunching(null);
    }
  }, [instState.instances, authState.currentUser, addToast]);

  const formatLastPlayed = (date: string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
  };

  // Empty state
  if (instState.instances.length === 0) {
    return (
      <div className="swift-animate-page-enter">
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <LaunchIcon size={32} />
          </div>
          <h1 className={styles.emptyTitle}>No Instances Yet</h1>
          <p className={styles.emptySubtitle}>Create your first instance to start playing Minecraft.</p>
          <Button variant="primary" size="large" onClick={() => navigate('/instances/new')}>
            <PlusIcon size={14} /> New Instance
          </Button>
        </div>
      </div>
    );
  }

  const primary = sortedInstances[0];
  // Use 3D viewer for local skin, image for Crafatar
  const use3DViewer = skinUrl?.startsWith('data:');

  return (
    <div className="swift-animate-page-enter">
      <div className={styles.layout}>
        {/* Left: Main content */}
        <div className={styles.main}>
          {/* Primary Launch — 1-step action */}
          <div className={styles.hero}>
            <div className={styles.heroInfo}>
              <div className={styles.heroTitle}>{primary.name}</div>
              <div className={styles.heroMeta}>
                {primary.version_id}
                {primary.loader_type && ` · ${primary.loader_type}`}
                {primary.loader_version && ` ${primary.loader_version}`}
                {counts[primary.id] && counts[primary.id].mods > 0 && ` · ${counts[primary.id].mods} mods`}
                {' · '}{formatLastPlayed(primary.last_played)}
              </div>
            </div>
            <Button
              variant="primary"
              size="large"
              onClick={() => handleLaunch(primary.id)}
              disabled={launching === primary.id}
            >
              <LaunchIcon size={14} /> {launching === primary.id ? 'Launching...' : 'Launch'}
            </Button>
          </div>

          {/* Recent Instances — 1-step launch each */}
          {sortedInstances.length > 1 && (
            <div className={styles.instanceList}>
              {sortedInstances.slice(1, 6).map((inst) => (
                <div
                  key={inst.id}
                  className={styles.instanceItem}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleLaunch(inst.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLaunch(inst.id); } }}
                >
                  <div className={styles.instanceInfo}>
                    <div className={styles.instanceName}>{inst.name}</div>
                    <div className={styles.instanceMeta}>
                      {inst.version_id}
                      {inst.loader_type && ` · ${inst.loader_type}`}
                      {counts[inst.id] && counts[inst.id].mods > 0 && ` · ${counts[inst.id].mods} mods`}
                      {' · '}{formatLastPlayed(inst.last_played)}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleLaunch(inst.id); }}
                    disabled={launching === inst.id}
                  >
                    <LaunchIcon size={12} /> {launching === inst.id ? '...' : 'Launch'}
                  </Button>
                </div>
              ))}
              <button className={styles.viewAll} onClick={() => navigate('/instances')}>
                View all instances <ChevronIcon size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Right: Player profile */}
        <div className={styles.profile}>
          <div className={styles.skinViewer}>
            {use3DViewer ? (
              <canvas ref={canvasRef} className={styles.skinCanvas} />
            ) : skinUrl ? (
              <img
                className={styles.skinImage}
                src={skinUrl}
                alt={`${username}'s skin`}
                draggable={false}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className={styles.skinPlaceholder}>?</div>
            )}
          </div>
          <div className={styles.profileName}>{username || 'Player'}</div>
          <div className={styles.profileStats}>
            <div className={styles.profileStat}>
              <span className={styles.profileStatValue}>{instState.instances.length}</span>
              <span className={styles.profileStatLabel}>Instances</span>
            </div>
            <div className={styles.profileStat}>
              <span className={styles.profileStatValue}>{totalMods}</span>
              <span className={styles.profileStatLabel}>Mods</span>
            </div>
            <div className={styles.profileStat}>
              <span className={styles.profileStatValue}>{totalPlaytime}h</span>
              <span className={styles.profileStatLabel}>Played</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
