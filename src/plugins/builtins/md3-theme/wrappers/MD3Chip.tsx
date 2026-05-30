import { useRef, useEffect } from 'react';
import type { MD3ChipProps } from '@/plugins/extensions';

type MdChipEl = HTMLElement & { selected: boolean };

const VARIANT_MAP = {
  assist: 'md-assist-chip',
  filter: 'md-filter-chip',
  input: 'md-input-chip',
  suggestion: 'md-suggestion-chip',
} as const;

export function MD3Chip({
  variant = 'assist',
  label,
  selected,
  onClick,
  onRemove,
  icon,
  disabled,
  elevated,
  href,
}: MD3ChipProps) {
  const ref = useRef<MdChipEl>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (selected !== undefined) el.selected = selected;
  }, [selected]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onRemove) return;
    el.addEventListener('remove', onRemove);
    return () => el.removeEventListener('remove', onRemove);
  }, [onRemove]);

  const Tag = VARIANT_MAP[variant];

  return (
    <Tag
      ref={ref as React.Ref<MdChipEl>}
      label={label}
      disabled={disabled || undefined}
      elevated={elevated || undefined}
      href={href || undefined}
    >
      {icon && <span slot="icon">{icon}</span>}
    </Tag>
  );
}
