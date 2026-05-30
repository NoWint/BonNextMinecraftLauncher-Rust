import { useState, useEffect, useCallback } from 'react';
import { readConfigFile, writeConfigFile } from '../../api/instances';
import { Button } from './Button';
import styles from './ConfigEditor.module.css';

interface ConfigEditorProps {
  instanceId: string;
  relativePath: string;
  onClose?: () => void;
}

export default function ConfigEditor({ instanceId, relativePath, onClose }: ConfigEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isBinary, setIsBinary] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    setIsBinary(false);
    readConfigFile(instanceId, relativePath)
      .then((text: string) => {
        setContent(text);
        setOriginalContent(text);
        setDirty(false);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Binary file')) {
          setIsBinary(true);
          setContent('');
          setOriginalContent('');
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [instanceId, relativePath]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setContent(val);
      setDirty(val !== originalContent);
    },
    [originalContent],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      await writeConfigFile(instanceId, relativePath, content);
      setOriginalContent(content);
      setDirty(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [instanceId, relativePath, content]);

  const handleCancel = useCallback(() => {
    if (dirty) {
      setContent(originalContent);
      setDirty(false);
    } else {
      onClose?.();
    }
  }, [dirty, originalContent, onClose]);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error && !isBinary) {
    return <div className={styles.error}>{error}</div>;
  }

  if (isBinary) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <span className={styles.path}>{relativePath}</span>
          <span className={styles.binaryBadge}>Binary</span>
        </div>
        <div className={styles.readOnlyNotice}>This is a binary file and cannot be edited in the text editor.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.path}>{relativePath}</span>
        {dirty && <span className={styles.dirtyBadge}>Modified</span>}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <textarea className={styles.editor} value={content} onChange={handleChange} spellCheck={false} />
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={handleCancel}>
          {dirty ? 'Revert' : 'Close'}
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
