import type { MD3IconProps } from '@/plugins/extensions';

export function MD3Icon({ name, children }: MD3IconProps) {
  return <md-icon>{name || children}</md-icon>;
}
