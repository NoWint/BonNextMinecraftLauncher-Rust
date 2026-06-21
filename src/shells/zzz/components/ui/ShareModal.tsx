import React, { useState, useEffect, useCallback } from 'react';
import { formatError } from '../../../../shared/utils/errorMapping';
import { api } from '../../../../shared/api';
import { Modal } from './Modal';
import { Button } from './Button';
import { Icon } from './Icon';
import { useToast } from '../../../../shared/stores/toastStore';
import { useI18n } from '../../../../shared/i18n';
import styles from './ShareModal.module.css';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ open, onClose, instanceId }) => {
  const { addToast } = useToast();
  const { t } = useI18n();
  const [exportedCode, setExportedCode] = useState<string>('');
  const [exportLoading, setExportLoading] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && instanceId) {
      setExportLoading(true);
      setExportedCode('');
      api
        .exportInstanceConfig(instanceId)
        .then((code) => setExportedCode(code))
        .catch(() => {
          setExportedCode('');
          addToast({ type: 'error', title: t('shareModal.exportFailed'), message: t('shareModal.exportFailedDesc') });
        })
        .finally(() => setExportLoading(false));
    }
  }, [open, instanceId]);

  const handleCopy = useCallback(async () => {
    if (!exportedCode) return;
    try {
      await navigator.clipboard.writeText(exportedCode);
      setCopied(true);
      addToast({ type: 'success', title: t('shareModal.copied'), message: t('shareModal.copiedDesc') });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ type: 'error', title: t('shareModal.copyFailed'), message: t('shareModal.copyFailedDesc') });
    }
  }, [exportedCode, addToast, t]);

  const handleImport = useCallback(async () => {
    const trimmed = importCode.trim();
    if (!trimmed) return;
    setImportLoading(true);
    try {
      const instance = await api.importInstanceConfig(trimmed);
      addToast({
        type: 'success',
        title: t('shareModal.importSuccess'),
        message: t('shareModal.importSuccessDesc', { name: instance.name }),
      });
      setImportCode('');
      onClose();
    } catch (e: unknown) {
      addToast({
        type: 'error',
        title: t('shareModal.importFailed'),
        message: formatError(e) || t('shareModal.invalidCode'),
      });
    } finally {
      setImportLoading(false);
    }
  }, [importCode, addToast, onClose, t]);

  const actions = (
    <Button variant="secondary" size="sm" onClick={onClose}>
      {t('common.close')}
    </Button>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('shareModal.title')} actions={actions}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('shareModal.export')}</div>
        <div className={styles.sectionDesc}>{t('shareModal.exportDesc')}</div>
        {exportLoading ? (
          <div className={styles.loading}>{t('shareModal.generating')}</div>
        ) : exportedCode ? (
          <>
            <textarea
              className={styles.textarea}
              readOnly
              value={exportedCode}
              rows={3}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <Button
              variant={copied ? 'secondary-highlight' : 'primary'}
              size="sm"
              onClick={handleCopy}
              style={{ marginTop: 6 }}
            >
              {copied ? (
                <>
                  <Icon name="check" size={12} /> {t('shareModal.copied')}
                </>
              ) : (
                <>
                  <Icon name="copy" size={14} /> {t('shareModal.copy')}
                </>
              )}
            </Button>
          </>
        ) : (
          <div className={styles.loading}>{t('shareModal.generateFailed')}</div>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('common.import')}</div>
        <div className={styles.sectionDesc}>{t('shareModal.importDesc')}</div>
        <textarea
          className={styles.textarea}
          placeholder={t('shareModal.importPlaceholder')}
          value={importCode}
          onChange={(e) => setImportCode(e.target.value)}
          rows={3}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleImport}
          disabled={importLoading || !importCode.trim()}
          style={{ marginTop: 6 }}
        >
          {importLoading ? (
            t('common.importing')
          ) : (
            <>
              <Icon name="download" size={14} /> {t('common.import')}
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
};
