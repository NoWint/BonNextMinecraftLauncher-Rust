import React, { useState, useEffect, useCallback } from 'react';
import { formatError } from '../../../../shared/utils/errorMapping';
import { api } from '../../../../shared/api';
import { Modal } from './Modal';
import { Button } from './Button';
import { Icon } from './Icon';
import { useToast } from '../../../../shared/stores/toastStore';
import styles from './ShareModal.module.css';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ open, onClose, instanceId }) => {
  const { addToast } = useToast();
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
          addToast({ type: 'error', title: 'Export failed', message: 'Could not export instance config.' });
        })
        .finally(() => setExportLoading(false));
    }
  }, [open, instanceId]);

  const handleCopy = useCallback(async () => {
    if (!exportedCode) return;
    try {
      await navigator.clipboard.writeText(exportedCode);
      setCopied(true);
      addToast({ type: 'success', title: 'Copied', message: 'Config code copied to clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ type: 'error', title: 'Copy failed', message: 'Could not copy to clipboard.' });
    }
  }, [exportedCode, addToast]);

  const handleImport = useCallback(async () => {
    const trimmed = importCode.trim();
    if (!trimmed) return;
    setImportLoading(true);
    try {
      const instance = await api.importInstanceConfig(trimmed);
      addToast({
        type: 'success',
        title: 'Import successful',
        message: `Instance "${instance.name}" has been imported.`,
      });
      setImportCode('');
      onClose();
    } catch (e: unknown) {
      addToast({
        type: 'error',
        title: 'Import failed',
        message: formatError(e) || 'Invalid config code.',
      });
    } finally {
      setImportLoading(false);
    }
  }, [importCode, addToast, onClose]);

  const actions = (
    <Button variant="secondary" size="sm" onClick={onClose}>
      CLOSE
    </Button>
  );

  return (
    <Modal open={open} onClose={onClose} title="SHARE CONFIG" actions={actions}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>EXPORT</div>
        <div className={styles.sectionDesc}>Share this code with others to let them import your instance setup.</div>
        {exportLoading ? (
          <div className={styles.loading}>Generating config code...</div>
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
                  <Icon name="check" size={12} /> COPIED
                </>
              ) : (
                <>
                  <Icon name="copy" size={14} /> COPY
                </>
              )}
            </Button>
          </>
        ) : (
          <div className={styles.loading}>Failed to generate config code.</div>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <div className={styles.sectionLabel}>IMPORT</div>
        <div className={styles.sectionDesc}>Paste a shared config code below to import an instance setup.</div>
        <textarea
          className={styles.textarea}
          placeholder="Paste config code here..."
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
            'IMPORTING...'
          ) : (
            <>
              <Icon name="download" size={14} /> IMPORT
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
};
