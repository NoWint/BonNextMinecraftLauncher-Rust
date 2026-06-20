interface IconProps {
  className?: string;
  size?: number;
}

export function LaunchIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2L14 8L3 14V2Z" fill="currentColor" />
    </svg>
  );
}
