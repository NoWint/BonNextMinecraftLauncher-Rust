interface IconProps {
  className?: string;
  size?: number;
}

export function CollectionsIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 2V14M2 6H14" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
