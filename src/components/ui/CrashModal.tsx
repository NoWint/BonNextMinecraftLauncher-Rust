import React from 'react';
import { Modal } from './Modal';
import type { CrashDiagnosis } from '../../api';
import styles from './CrashModal.module.css';

interface CrashModalProps {
  open: boolean;
  onClose: () => void;
  diagnosis: CrashDiagnosis | null;
  onAutoFix?: (action: string) => void;
}

const severityIcon: Record<string, string> = {
  high: '⛔',
  medium: '⚠️',
  low: '💡',
  info: 'ℹ️',
};

const severityClass: Record<string, string> = {
  high: styles.findingHigh,
  medium: styles.findingMedium,
  low: styles.findingLow,
  info: styles.findingInfo,
};

export const CrashModal: React.FC<CrashModalProps> = ({ open, onClose, diagnosis, onAutoFix }) => {
  if (!diagnosis) return null;

  const { crash_info, additional_findings, auto_fix_available, auto_fix_action } = diagnosis;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="崩溃诊断报告"
      actions={
        <div className={styles.actions}>
          {auto_fix_available && auto_fix_action && onAutoFix && (
            <button className={styles.autoFixBtn} onClick={() => onAutoFix(auto_fix_action)}>
              一键修复
            </button>
          )}
          <button className={styles.closeBtn} onClick={onClose}>
            关闭
          </button>
        </div>
      }
    >
      <div className={styles.diagnosis}>
        <div className={`${styles.mainError} ${crash_info.severity === 'high' ? styles.errorHigh : crash_info.severity === 'medium' ? styles.errorMedium : styles.errorLow}`}>
          <div className={styles.errorHeader}>
            <span className={styles.errorIcon}>{severityIcon[crash_info.severity] || '❓'}</span>
            <span className={styles.errorType}>{crash_info.error_type}</span>
          </div>
          <div className={styles.errorDesc}>{crash_info.description}</div>
          <div className={styles.errorSuggestion}>{crash_info.suggestion}</div>
        </div>

        {additional_findings.length > 0 && (
          <div className={styles.findings}>
            <div className={styles.findingsTitle}>附加发现</div>
            {additional_findings.map((f, i) => (
              <div key={i} className={`${styles.finding} ${severityClass[f.severity] || styles.findingInfo}`}>
                <span className={styles.findingIcon}>{severityIcon[f.severity] || 'ℹ️'}</span>
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
