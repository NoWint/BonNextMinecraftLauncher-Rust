interface IconProps {
  className?: string;
  size?: number;
  filled?: boolean;
}

export function HeartIcon({ className, size = 16, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.75 2.5C6.85 2.5 7.7 3.05 8 3.8C8.3 3.05 9.15 2.5 10.25 2.5C12 2.5 13.5 4 13.5 6.5C13.5 10.5 8 14 8 14Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
