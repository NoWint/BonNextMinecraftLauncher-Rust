interface IconProps {
  className?: string;
  size?: number;
}

export function RefreshIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2.5 8C2.5 4.96 4.96 2.5 8 2.5C10.3 2.5 12.26 3.9 13.08 5.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13.5 8C13.5 11.04 11.04 13.5 8 13.5C5.7 13.5 3.74 12.1 2.92 10.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.5 5.9H13.5V2.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
