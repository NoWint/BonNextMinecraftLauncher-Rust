import { useState } from 'react';
import { Modal } from './Modal';
import { Icon, type IconName } from './Icon';
import { api } from '../../../../shared/api';
import type { CrashDiagnosis } from '../../../../shared/api';
import { useI18n } from '../../../../shared/i18n';
import styles from './CrashDiagnosisModal.module.css';

interface CrashDiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  logContent: string;
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

export default function CrashDiagnosisModal({ isOpen, onClose, logContent }: CrashDiagnosisModalProps) {
  const { t } = useI18n();
  const [diagnosis, setDiagnosis] = useState<CrashDiagnosis | null>(null);
  const [loading, setLoading] = useState(false);

  const severityLabel: Record<string, string> = {
    high: t('crashDiagnosis.severity.critical'),
    medium: t('crashDiagnosis.severity.warning'),
    low: t('crashDiagnosis.severity.tip'),
    info: t('crashDiagnosis.severity.info'),
  };

  const handleDiagnose = async () => {
    setLoading(true);
    try {
      const result = await api.diagnoseCrashFromContent(logContent);
      setDiagnosis(result);
    } catch {
      setDiagnosis({
        crash_info: {
          description: t('crashDiagnosis.cannotDiagnose'),
          suggestion: t('crashDiagnosis.cannotDiagnoseDesc'),
          severity: 'info',
          error_type: 'unknown',
        },
        additional_findings: [],
        auto_fix_available: false,
        auto_fix_action: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportLog = () => {
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crash-log.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const actions = diagnosis ? (
    <div className={styles.actions}>
      <button onClick={handleExportLog} className={styles.exportBtn}>{t('crashDiagnosis.exportLogs')}</button>
      <button onClick={onClose} className={styles.closeBtn}>{t('common.close')}</button>
    </div>
  ) : undefined;

  return (
    <Modal open={isOpen} onClose={onClose} title={t('crashDiagnosis.title')} actions={actions}>
      <div className={styles.container}>
        {!diagnosis && !loading && (
          <div className={styles.prompt}>
            <p>{t('crashDiagnosis.prompt')}</p>
            <div className={styles.promptActions}>
              <button onClick={handleDiagnose} className={styles.diagnoseBtn}>{t('crashDiagnosis.startDiagnosis')}</button>
              <button onClick={handleExportLog} className={styles.exportBtn}>{t('crashDiagnosis.exportLogs')}</button>
            </div>
          </div>
        )}
        {loading && <div className={styles.loading}>{t('crashDiagnosis.analyzing')}</div>}
        {diagnosis && (
          <div className={styles.result}>
            <div
              className={`${styles.mainError} ${
                diagnosis.crash_info.severity === 'high'
                  ? styles.errorHigh
                  : diagnosis.crash_info.severity === 'medium'
                    ? styles.errorMedium
                    : styles.errorLow
              }`}
            >
              <div className={styles.errorHeader}>
                <span className={styles.errorIcon}>
                  <Icon name={(severityIcon[diagnosis.crash_info.severity] as IconName) || 'question'} size={14} />
                </span>
                <span className={styles.errorType}>{diagnosis.crash_info.error_type}</span>
                <span
                  className={`${styles.severityBadge} ${
                    diagnosis.crash_info.severity === 'high'
                      ? styles.severityCritical
                      : diagnosis.crash_info.severity === 'medium'
                        ? styles.severityWarning
                        : styles.severityInfo
                  }`}
                >
                  {severityLabel[diagnosis.crash_info.severity] || t('common.unknown')}
                </span>
              </div>
              <div className={styles.errorDesc}>{diagnosis.crash_info.description}</div>
              <div className={styles.errorSuggestion}>{diagnosis.crash_info.suggestion}</div>
            </div>

            {diagnosis.additional_findings.length > 0 && (
              <div className={styles.findings}>
                <div className={styles.findingsTitle}>{t('crashDiagnosis.additionalFindings')}</div>
                {diagnosis.additional_findings.map((f, i) => (
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
        )}
      </div>
    </Modal>
  );
}
