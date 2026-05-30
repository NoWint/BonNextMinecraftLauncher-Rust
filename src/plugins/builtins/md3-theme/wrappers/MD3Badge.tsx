import type { MD3BadgeProps } from '@/plugins/extensions';

export function MD3Badge({ value, variant = 'small' }: MD3BadgeProps) {
  return <md-badge value={value !== undefined ? String(value) : undefined} variant={variant} />;
}
