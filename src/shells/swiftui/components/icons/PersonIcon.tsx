interface IconProps {
  className?: string;
  size?: number;
}

export function PersonIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 14.5C2.5 11.5 5 9.5 8 9.5C11 9.5 13.5 11.5 13.5 14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
