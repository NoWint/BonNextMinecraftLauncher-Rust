interface IconProps {
  className?: string;
  size?: number;
}

export function GlobeIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 8H14M8 2C5.5 4.2 5.5 11.8 8 14M8 2C10.5 4.2 10.5 11.8 8 14" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
