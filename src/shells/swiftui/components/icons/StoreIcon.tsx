interface IconProps {
  className?: string;
  size?: number;
}

export function StoreIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="3" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6.5H14.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 6.5V14" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
