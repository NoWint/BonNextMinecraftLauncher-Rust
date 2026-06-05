import type { NavigationRailProps } from '@/plugins/extensions';
import { Icon } from '@/shells/zzz/components/ui/Icon';
import { MD3FAB } from '../wrappers/MD3FAB';
import s from './MD3NavigationRail.module.css';

export function MD3NavigationRail({ items, activeId, onNavigate, fabIcon, fabLabel, onFabClick }: NavigationRailProps) {
  return (
    <nav className={s.rail}>
      {items.map((item) => (
        <button
          key={item.id}
          className={`${s.navItem} ${item.id === activeId ? s.navItemActive : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-current={item.id === activeId ? 'page' : undefined}
        >
          <span className={s.navIcon}>
            <Icon name={item.icon} size={20} />
          </span>
          <span className={s.navLabel}>{item.label}</span>
        </button>
      ))}
      <div className={s.spacer} />
      {fabIcon && (
        <div className={s.fab}>
          <MD3FAB icon={fabIcon} label={fabLabel} onClick={onFabClick} variant="surface" size="medium" />
        </div>
      )}
    </nav>
  );
}
