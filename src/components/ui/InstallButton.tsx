import { useState } from 'react';
import { api } from '../../api';
import { useToast } from '../../stores/toastStore';
import { Button } from './Button';

interface InstallButtonProps {
  contentSlug: string;
  contentTitle: string;
  instanceId: string;
  gameVersion?: string;
  loader?: string;
  contentType?: string;
  onInstalled?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function InstallButton({
  contentSlug,
  contentTitle,
  instanceId,
  gameVersion,
  loader,
  contentType,
  onInstalled,
  size = 'sm',
}: InstallButtonProps) {
  const [installing, setInstalling] = useState(false);
  const { addToast } = useToast();

  const handleInstall = async () => {
    if (!instanceId) {
      addToast({ type: 'warning', title: 'No instance', message: 'Select an instance first.' });
      return;
    }

    setInstalling(true);
    try {
      const versions = await api.getModVersions(
        contentSlug,
        gameVersion,
        loader || undefined,
      );

      if (versions.length === 0) {
        addToast({
          type: 'error',
          title: 'No compatible version',
          message: `${contentTitle} has no version for your config.`,
        });
        setInstalling(false);
        return;
      }

      const latest = versions[0];
      const primaryFile = latest.files.find(
        (f) => !f.filename.includes('sources') && !f.filename.includes('javadoc'),
      ) || latest.files[0];

      await api.installContent(
        primaryFile.url,
        primaryFile.filename,
        instanceId,
        contentType || 'mod',
        primaryFile.hashes.sha1 || undefined,
        contentSlug,
        latest.id,
      );

      addToast({
        type: 'success',
        title: 'Installed',
        message: `${contentTitle} ${latest.version_number}`,
      });
      onInstalled?.();
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'Install failed',
        message: e?.toString() || 'Unknown error',
      });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Button
      variant="secondary-highlight"
      size={size}
      disabled={installing}
      onClick={handleInstall}
    >
      {installing ? '...' : 'Install'}
    </Button>
  );
}
