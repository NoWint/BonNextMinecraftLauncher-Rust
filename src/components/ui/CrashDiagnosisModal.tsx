import { useState } from 'react';
import { Modal } from './Modal';
import { Icon, type IconName } from './Icon';
import { api } from '../../api';
import type { CrashDiagnosis } from '../../api';
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

const severityLabel: Record<string, string> = {
  high: '严重',
  medium: '警告',
  low: '提示',
  info: '信息',
};

export default function CrashDiagnosisModal({ isOpen, onClose, logContent }: CrashDiagnosisModalProps) {
  const [diagnosis, setDiagnosis] = useState<CrashDiagnosis | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDiagnose = async () => {
    setLoading(true);
    try {
      const result = await api.diagnoseCrashFromContent(logContent);
      setDiagnosis(result);
    } catch {
      setDiagnosis({
        crash_info: {
          description: '无法诊断崩溃原因',
          suggestion: '请检查日志文件或寻求社区帮助',
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
      <button onClick={handleExportLog} className={styles.exportBtn}>导出日志</button>
      <button onClick={onClose} className={styles.closeBtn}>关闭</button>
    </div>
  ) : undefined;

  return (
    <Modal open={isOpen} onClose={onClose} title="崩溃诊断" actions={actions}>
      <div className={styles.container}>
        {!diagnosis && !loading && (
          <div className={styles.prompt}>
            <p>检测到游戏异常退出，是否进行崩溃诊断？</p>
            <div className={styles.promptActions}>
              <button onClick={handleDiagnose} className={styles.diagnoseBtn}>开始诊断</button>
              <button onClick={handleExportLog} className={styles.exportBtn}>导出日志</button>
            </div>
          </div>
        )}
        {loading && <div className={styles.loading}>正在分析崩溃日志...</div>}
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
                  {severityLabel[diagnosis.crash_info.severity] || '未知'}
                </span>
              </div>
              <div className={styles.errorDesc}>{diagnosis.crash_info.description}</div>
              <div className={styles.errorSuggestion}>{diagnosis.crash_info.suggestion}</div>
            </div>

            {diagnosis.additional_findings.length > 0 && (
              <div className={styles.findings}>
                <div className={styles.findingsTitle}>附加发现</div>
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
