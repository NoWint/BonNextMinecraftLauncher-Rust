interface IconProps {
  className?: string;
  size?: number;
}

export function ShieldIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5L2.5 4V8C2.5 11.5 5 14 8 14.5C11 14 13.5 11.5 13.5 8V4L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
