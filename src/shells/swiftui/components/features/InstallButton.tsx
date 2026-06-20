import { Button, ProgressBar } from '../ui';
import styles from './InstallButton.module.css';

interface InstallButtonProps { status: 'idle' | 'installing' | 'installed' | 'updating'; progress?: number; onClick: () => void; }

export function InstallButton({ status, progress, onClick }: InstallButtonProps) {
  const variant = status === 'installed' ? 'secondary' : 'primary';
  const label = { idle: 'Install', installing: `Installing${progress !== undefined ? ` ${Math.round(progress)}%` : ''}`, installed: 'Installed', updating: 'Update' }[status];
  return (
    <div className={styles.button}>
      <Button variant={variant} onClick={onClick} disabled={status === 'installing'} aria-label={status === 'idle' ? 'Install' : status === 'installing' ? 'Installing' : status === 'installed' ? 'Installed' : 'Update available'}>{label}</Button>
      {status === 'installing' && progress !== undefined && <ProgressBar value={progress} />}
    </div>
  );
}
