import type { MD3DividerProps } from '@/plugins/extensions';

export function MD3Divider({ inset }: MD3DividerProps) {
  return <md-divider inset={inset || undefined} />;
}
