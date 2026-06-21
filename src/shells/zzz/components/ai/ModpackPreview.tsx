import React from 'react';
import type { ModpackPlan } from '../../../../shared/ai/types';
import { useI18n } from '../../../../shared/i18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
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
  const { t } = useI18n();
  const categoryClass = (cat: string) =>
    CATEGORY_CLASS_MAP[cat] || styles['modCategory--default'];

  return (
    <Modal
      open
      onClose={onCancel}
      title={plan.theme}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('ai.modpack.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={() => onInstall(plan)}>
            {t('ai.modpack.install')}
          </Button>
        </>
      }
    >
      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>{t('ai.modpack.version')}</span>
          <span className={styles.infoValue}>{plan.game_version}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>{t('ai.modpack.loader')}</span>
          <span className={styles.infoValue}>{plan.loader.loader_type} {plan.loader.version}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>{t('ai.modpack.modsLabel')}</span>
          <span className={styles.infoValue}>{plan.mods.length}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>{t('ai.modpack.size')}</span>
          <span className={styles.infoValue}>{plan.estimated_size_mb} MB</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>{t('ai.modpack.memory')}</span>
          <span className={styles.infoValue}>{plan.jvm_config.max_memory_mb} MB</span>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>{t('ai.modpack.modsTitle')}</h3>
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
          <h3 className={styles.sectionTitle}>{t('ai.modpack.warnings')}</h3>
          <div className={styles.warningList}>
            {plan.warnings.map((w, i) => (
              <div key={i} className={styles.warning}>{w.message}</div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
};
