export type Tone =
  | 0
  | 4
  | 6
  | 10
  | 12
  | 17
  | 20
  | 22
  | 30
  | 40
  | 50
  | 60
  | 70
  | 80
  | 90
  | 92
  | 94
  | 95
  | 96
  | 98
  | 99
  | 100;
export type TonalPalette = Record<Tone, string>;

export interface MD3ThemeTokens {
  primary: TonalPalette;
  secondary: TonalPalette;
  tertiary: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  error: TonalPalette;
}

export type CSSVariableMap = Record<string, string>;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r),
    lg = srgbToLinear(g),
    lb = srgbToLinear(b);
  return [
    0.4124 * lr + 0.3576 * lg + 0.1805 * lb,
    0.2126 * lr + 0.7152 * lg + 0.0722 * lb,
    0.0193 * lr + 0.1192 * lg + 0.9505 * lb,
  ];
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const xn = 0.95047,
    yn = 1.0,
    zn = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / xn),
    fy = f(y / yn),
    fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToXyz(l: number, a: number, b: number): [number, number, number] {
  const xn = 0.95047,
    yn = 1.0,
    zn = 1.08883;
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const finv = (t: number) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  return [xn * finv(fx), yn * finv(fy), zn * finv(fz)];
}

function xyzToRgb(x: number, y: number, z: number): [number, number, number] {
  const lr = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const lg = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const lb = 0.0557 * x - 0.204 * y + 1.057 * z;
  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

function rgbToHct(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b);
  const [l, a, bv] = xyzToLab(x, y, z);
  const hue = Math.atan2(bv, a) * (180 / Math.PI);
  const chroma = Math.sqrt(a * a + bv * bv);
  return [hue < 0 ? hue + 360 : hue, chroma, l];
}

function hctToRgb(hue: number, chroma: number, tone: number): [number, number, number] {
  const hRad = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hRad);
  const b = chroma * Math.sin(hRad);
  const [x, y, z] = labToXyz(tone, a, b);
  return xyzToRgb(x, y, z);
}

function generateTonalPalette(hue: number, chroma: number): TonalPalette {
  const tones: Tone[] = [0, 4, 6, 10, 12, 17, 20, 22, 30, 40, 50, 60, 70, 80, 90, 92, 94, 95, 96, 98, 99, 100];
  const palette: Partial<TonalPalette> = {};
  for (const tone of tones) {
    const [r, g, b] = hctToRgb(hue, chroma, tone);
    palette[tone] = rgbToHex(r, g, b);
  }
  return palette as TonalPalette;
}

function rotateHue(hue: number, degrees: number): number {
  return (hue + degrees) % 360;
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function generateDerivedVars(primaryHex: string, onSurfaceHex: string, isDark: boolean): CSSVariableMap {
  return {
    '--color-accent-action': primaryHex,
    '--color-accent-action-text': isDark ? '#ffffff' : '#ffffff',
    '--color-accent-06': hexToRgba(primaryHex, 0.06),
    '--color-accent-10': hexToRgba(primaryHex, 0.1),
    '--color-accent-15': hexToRgba(primaryHex, 0.15),
    '--color-accent-20': hexToRgba(primaryHex, 0.2),
    '--color-accent-30': hexToRgba(primaryHex, 0.3),
    '--color-overlay-30': isDark ? 'rgba(0, 0, 0, 0.30)' : 'rgba(0, 0, 0, 0.15)',
    '--color-overlay-50': isDark ? 'rgba(0, 0, 0, 0.50)' : 'rgba(0, 0, 0, 0.30)',
    '--color-overlay-60': isDark ? 'rgba(0, 0, 0, 0.60)' : 'rgba(0, 0, 0, 0.40)',
    '--color-overlay-80': isDark ? 'rgba(0, 0, 0, 0.80)' : 'rgba(0, 0, 0, 0.60)',
    '--shadow-card': isDark
      ? '0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15)'
      : '0 1px 2px rgba(0,0,0,0.08), 0 1px 3px 1px rgba(0,0,0,0.04)',
    '--shadow-elevated': isDark
      ? '0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15)'
      : '0 1px 2px rgba(0,0,0,0.12), 0 2px 6px 2px rgba(0,0,0,0.06)',
    '--selection-bg': hexToRgba(primaryHex, isDark ? 0.3 : 0.15),
    '--selection-color': onSurfaceHex,
    '--scrollbar-thumb-color': isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.20)',
    '--scrollbar-thumb-hover': isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)',
  };
}

export class MD3ColorSystem {
  generateFromSeed(seedColor: string): MD3ThemeTokens {
    const [r, g, b] = hexToRgb(seedColor);
    const [hue, chroma, _tone] = rgbToHct(r, g, b);

    return {
      primary: generateTonalPalette(hue, Math.max(chroma, 48)),
      secondary: generateTonalPalette(rotateHue(hue, 30), Math.min(chroma, 16)),
      tertiary: generateTonalPalette(rotateHue(hue, 60), Math.min(Math.max(chroma, 24), 32)),
      neutral: generateTonalPalette(hue, Math.min(chroma, 4)),
      neutralVariant: generateTonalPalette(hue, Math.min(chroma, 8)),
      error: generateTonalPalette(25, 84),
    };
  }

  generateFromImage(_imageData: ImageData): MD3ThemeTokens {
    return this.generateFromSeed('#6750A4');
  }

  getTokensForMode(tokens: MD3ThemeTokens, mode: 'light' | 'dark'): CSSVariableMap {
    if (mode === 'dark') {
      return {
        '--md3-primary': tokens.primary[80],
        '--md3-on-primary': tokens.primary[20],
        '--md3-primary-container': tokens.primary[30],
        '--md3-on-primary-container': tokens.primary[90],
        '--md3-secondary': tokens.secondary[80],
        '--md3-on-secondary': tokens.secondary[20],
        '--md3-secondary-container': tokens.secondary[30],
        '--md3-on-secondary-container': tokens.secondary[90],
        '--md3-tertiary': tokens.tertiary[80],
        '--md3-on-tertiary': tokens.tertiary[20],
        '--md3-tertiary-container': tokens.tertiary[30],
        '--md3-on-tertiary-container': tokens.tertiary[90],
        '--md3-error': tokens.error[80],
        '--md3-on-error': tokens.error[20],
        '--md3-error-container': tokens.error[30],
        '--md3-on-error-container': tokens.error[90],
        '--md3-surface': tokens.neutral[6],
        '--md3-on-surface': tokens.neutral[90],
        '--md3-surface-variant': tokens.neutralVariant[30],
        '--md3-on-surface-variant': tokens.neutralVariant[80],
        '--md3-surface-container-lowest': tokens.neutral[4],
        '--md3-surface-container-low': tokens.neutral[10],
        '--md3-surface-container': tokens.neutral[12],
        '--md3-surface-container-high': tokens.neutral[17],
        '--md3-surface-container-highest': tokens.neutral[22],
        '--md3-outline': tokens.neutralVariant[60],
        '--md3-outline-variant': tokens.neutralVariant[30],
        '--md3-inverse-surface': tokens.neutral[90],
        '--md3-inverse-on-surface': tokens.neutral[10],
        '--md3-scrim': tokens.neutral[0],
        '--md3-shadow': tokens.neutral[0],
        '--bg-primary': tokens.neutral[6],
        '--bg-secondary': tokens.neutral[12],
        '--bg-card': tokens.neutral[17],
        '--text-primary': tokens.neutral[90],
        '--text-secondary': tokens.neutralVariant[80],
        '--text-muted': tokens.neutralVariant[60],
        '--accent': tokens.primary[80],
        '--border': tokens.neutralVariant[30],
        '--border-hover': tokens.neutralVariant[60],
        '--danger': tokens.error[80],
        '--success': tokens.tertiary[80],
        '--color-sidebar': tokens.neutral[10],
        ...generateDerivedVars(tokens.primary[80], tokens.neutral[90], true),
      };
    }

    return {
      '--md3-primary': tokens.primary[40],
      '--md3-on-primary': tokens.primary[100],
      '--md3-primary-container': tokens.primary[90],
      '--md3-on-primary-container': tokens.primary[10],
      '--md3-secondary': tokens.secondary[40],
      '--md3-on-secondary': tokens.secondary[100],
      '--md3-secondary-container': tokens.secondary[90],
      '--md3-on-secondary-container': tokens.secondary[10],
      '--md3-tertiary': tokens.tertiary[40],
      '--md3-on-tertiary': tokens.tertiary[100],
      '--md3-tertiary-container': tokens.tertiary[90],
      '--md3-on-tertiary-container': tokens.tertiary[10],
      '--md3-error': tokens.error[40],
      '--md3-on-error': tokens.error[100],
      '--md3-error-container': tokens.error[90],
      '--md3-on-error-container': tokens.error[10],
      '--md3-surface': tokens.neutral[98],
      '--md3-on-surface': tokens.neutral[10],
      '--md3-surface-variant': tokens.neutralVariant[90],
      '--md3-on-surface-variant': tokens.neutralVariant[30],
      '--md3-surface-container-lowest': tokens.neutral[100],
      '--md3-surface-container-low': tokens.neutral[96],
      '--md3-surface-container': tokens.neutral[94],
      '--md3-surface-container-high': tokens.neutral[92],
      '--md3-surface-container-highest': tokens.neutral[90],
      '--md3-outline': tokens.neutralVariant[50],
      '--md3-outline-variant': tokens.neutralVariant[80],
      '--md3-inverse-surface': tokens.neutral[20],
      '--md3-inverse-on-surface': tokens.neutral[95],
      '--md3-scrim': tokens.neutral[0],
      '--md3-shadow': tokens.neutral[0],
      '--bg-primary': tokens.neutral[98],
      '--bg-secondary': tokens.neutral[94],
      '--bg-card': tokens.neutral[100],
      '--text-primary': tokens.neutral[10],
      '--text-secondary': tokens.neutralVariant[30],
      '--text-muted': tokens.neutralVariant[50],
      '--accent': tokens.primary[40],
      '--border': tokens.neutralVariant[80],
      '--border-hover': tokens.neutralVariant[50],
      '--danger': tokens.error[40],
      '--success': tokens.tertiary[40],
      '--color-sidebar': tokens.neutral[96],
      ...generateDerivedVars(tokens.primary[40], tokens.neutral[10], false),
    };
  }
}
