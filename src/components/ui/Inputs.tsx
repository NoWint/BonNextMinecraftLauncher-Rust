import React from 'react';
import styles from './Inputs.module.css';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const TextInput: React.FC<TextInputProps> = ({ className = '', ...props }) => (
  <input className={`${styles.textInput} ${className}`} {...props} />
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ options, className = '', ...props }) => (
  <select className={`${styles.select} ${className}`} {...props}>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

interface ToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ on, onChange, className = '' }) => (
  <button
    type="button"
    className={`${styles.toggle} ${on ? styles['toggle--on'] : styles['toggle--off']} ${className}`}
    onClick={() => onChange(!on)}
    role="switch"
    aria-checked={on}
  >
    <div className={styles.toggle__thumb} />
  </button>
);

interface CheckboxProps {
  on: boolean;
  onChange: (on: boolean) => void;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ on, onChange, className = '' }) => (
  <button
    type="button"
    className={`${styles.checkbox} ${on ? styles['checkbox--on'] : styles['checkbox--off']} ${className}`}
    onClick={() => onChange(!on)}
    role="checkbox"
    aria-checked={on}
  >
    {on && '✓'}
  </button>
);

interface SliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
  /** Show gradient fill colors (green→yellow→red) */
  gradient?: boolean;
}

function getSliderColor(pct: number): string {
  // Green at 0%, yellow at 50%, red at 100%
  if (pct <= 50) {
    const t = pct / 50;
    const r = Math.round(0 + t * 255);
    const g = Math.round(255 - t * 25);
    return `rgb(${r}, ${g}, 0)`;
  } else {
    const t = (pct - 50) / 50;
    const g = Math.round(230 - t * 140);
    return `rgb(255, ${g}, 0)`;
  }
}

export const Slider: React.FC<SliderProps> = ({ value, min, max, onChange, className = '', gradient }) => {
  const pct = ((value - min) / (max - min)) * 100;
  const fillColor = gradient ? getSliderColor(pct) : undefined;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const val = Math.round(min + pct * (max - min));
    onChange(Math.max(min, Math.min(max, val)));
  };

  return (
    <div className={`${styles.slider} ${className}`} onClick={handleClick}>
      <div
        className={styles.slider__fill}
        style={{ width: `${pct}%`, background: fillColor }}
      />
      <div className={styles.slider__thumb} style={{ left: `${pct}%` }} />
    </div>
  );
};
