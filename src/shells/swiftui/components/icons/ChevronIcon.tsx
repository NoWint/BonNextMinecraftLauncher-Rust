interface IconProps {
  className?: string;
  size?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const rotationMap: Record<string, string> = {
  right: '0deg',
  down: '90deg',
  left: '180deg',
  up: '270deg',
};

export function ChevronIcon({ className, size = 16, direction = 'right' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      style={{ transform: `rotate(${rotationMap[direction]})` }}
    >
      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
