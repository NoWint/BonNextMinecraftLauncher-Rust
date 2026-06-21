import React from 'react';
import { Modal } from './Modal';
import { Icon, type IconName } from './Icon';
import type { CrashDiagnosis } from '../../../../shared/api';
import { useI18n } from '../../../../shared/i18n';
import styles from './CrashModal.module.css';

interface CrashModalProps {
  open: boolean;
  onClose: () => void;
  diagnosis: CrashDiagnosis | null;
  onAutoFix?: (action: string) => void;
}

const severityIcon: Record<string, IconName> = {
  high: 'stop',
  medium: 'warning',
  low: 'lightbulb',
  info: 'info',
};

const severityClass: Record<string, string> = {
  high: styles.findingHigh,
  medium: styles.findingMedium,
  low: styles.findingLow,
  info: styles.findingInfo,
};

export const CrashModal: React.FC<CrashModalProps> = ({ open, onClose, diagnosis, onAutoFix }) => {
  const { t } = useI18n();
  if (!diagnosis) return null;

  const { crash_info, additional_findings, auto_fix_available, auto_fix_action } = diagnosis;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('crashModal.title')}
      actions={
        <div className={styles.actions}>
          {auto_fix_available && auto_fix_action && onAutoFix && (
            <button className={styles.autoFixBtn} onClick={() => onAutoFix(auto_fix_action)}>
              {t('crashModal.oneClickFix')}
            </button>
          )}
          <button className={styles.closeBtn} onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div className={styles.diagnosis}>
        <div
          className={`${styles.mainError} ${crash_info.severity === 'high' ? styles.errorHigh : crash_info.severity === 'medium' ? styles.errorMedium : styles.errorLow}`}
        >
          <div className={styles.errorHeader}>
            <span className={styles.errorIcon}>
              <Icon name={(severityIcon[crash_info.severity] as IconName) || 'question'} size={14} />
            </span>
            <span className={styles.errorType}>{crash_info.error_type}</span>
          </div>
          <div className={styles.errorDesc}>{crash_info.description}</div>
          <div className={styles.errorSuggestion}>{crash_info.suggestion}</div>
        </div>

        {additional_findings.length > 0 && (
          <div className={styles.findings}>
            <div className={styles.findingsTitle}>{t('crashModal.additionalFindings')}</div>
            {additional_findings.map((f, i) => (
              <div key={i} className={`${styles.finding} ${severityClass[f.severity] || styles.findingInfo}`}>
                <span className={styles.findingIcon}>
                  <Icon name={(severityIcon[f.severity] as IconName) || 'info'} size={14} />
                </span>
                <div className={styles.findingContent}>
                  <div className={styles.findingName}>{f.finding}</div>
                  <div className={styles.findingDetail}>{f.detail}</div>
                </div>
                <span className={styles.findingCategory}>{f.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
