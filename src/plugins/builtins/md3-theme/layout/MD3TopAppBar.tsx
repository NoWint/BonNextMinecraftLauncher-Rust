import type { TopAppBarProps } from '@/plugins/extensions';
import { Icon } from '@/components/ui/Icon';
import s from './MD3TopAppBar.module.css';

export function MD3TopAppBar({ title, onSearchClick, onSettingsClick }: TopAppBarProps) {
  const isMac = navigator.platform.toUpperCase().includes('MAC');

  return (
    <header className={s.topBar}>
      {isMac && <div className={s.macosSpacer} />}
      <h1 className={s.title}>{title}</h1>
      <div className={s.actions}>
        {onSearchClick && (
          <button className={s.iconBtn} onClick={onSearchClick} aria-label="Search">
            <Icon name="search" size={18} />
          </button>
        )}
        {onSettingsClick && (
          <button className={s.iconBtn} onClick={onSettingsClick} aria-label="Settings">
            <Icon name="settings" size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
