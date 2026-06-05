import React from 'react';
import type { ModpackPlan } from '../../ai/types';
import styles from './ModpackPreview.module.css';

interface ModpackPreviewProps {
  plan: ModpackPlan;
  onInstall: (plan: ModpackPlan) => void;
  onCancel: () => void;
}

const CATEGORY_CLASS_MAP: Record<string, string> = {
  core: styles['modCategory--core'],
  optimization: styles['modCategory--optimization'],
  library: styles['modCategory--library'],
};

export const ModpackPreview: React.FC<ModpackPreviewProps> = ({ plan, onInstall, onCancel }) => {
  const categoryClass = (cat: string) =>
    CATEGORY_CLASS_MAP[cat] || styles['modCategory--default'];

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{plan.theme}</h2>
          <button className={styles.closeBtn} onClick={onCancel}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Version</span>
              <span className={styles.infoValue}>{plan.game_version}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Loader</span>
              <span className={styles.infoValue}>{plan.loader.loader_type} {plan.loader.version}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Mods</span>
              <span className={styles.infoValue}>{plan.mods.length}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Size</span>
              <span className={styles.infoValue}>{plan.estimated_size_mb} MB</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Memory</span>
              <span className={styles.infoValue}>{plan.jvm_config.max_memory_mb} MB</span>
            </div>
          </div>

          <h3 className={styles.sectionTitle}>Mods</h3>
          <div className={styles.modList}>
            {plan.mods.map((mod) => (
              <div key={mod.slug} className={styles.modItem}>
                <span className={styles.modName}>{mod.name}</span>
                <span className={`${styles.modCategory} ${categoryClass(mod.category)}`}>
                  {mod.category}
                </span>
              </div>
            ))}
          </div>

          {plan.warnings.length > 0 && (
            <>
              <h3 className={styles.sectionTitle}>Warnings</h3>
              <div className={styles.warningList}>
                {plan.warnings.map((w, i) => (
                  <div key={i} className={styles.warning}>{w.message}</div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.installBtn} onClick={() => onInstall(plan)}>Install</button>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
