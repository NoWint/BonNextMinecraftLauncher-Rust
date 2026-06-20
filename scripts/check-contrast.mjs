import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const themesPath = join(__dirname, '..', 'src', 'styles', 'themes.css');

const PAIRS = [
  { fg: '--text-primary', bg: '--bg-primary', label: 'text-primary / bg-primary' },
  { fg: '--text-secondary', bg: '--bg-primary', label: 'text-secondary / bg-primary' },
  { fg: '--text-muted', bg: '--bg-primary', label: 'text-muted / bg-primary' },
  { fg: '--accent', bg: '--bg-primary', label: 'accent / bg-primary' },
  { fg: '--color-text-faint', bg: '--bg-card', label: 'color-text-faint / bg-card' },
];

const THEMES = ['.theme-dark', '.theme-light', '.theme-oled'];
const WCAG_AA_THRESHOLD = 4.5;

function parseHex(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(parseHex(hex1));
  const l2 = relativeLuminance(parseHex(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseThemes(css) {
  const result = {};
  for (const theme of THEMES) {
    const themeName = theme.replace('.', '');
    const regex = new RegExp(`${theme.replace('.', '\\.')}\\s*\\{([^}]+)\\}`, 's');
    const match = css.match(regex);
    if (!match) continue;
    const vars = {};
    const varRegex = /--([\w-]+)\s*:\s*([^;]+)/g;
    let m;
    while ((m = varRegex.exec(match[1])) !== null) {
      vars[`--${m[1]}`] = m[2].trim();
    }
    result[themeName] = vars;
  }
  return result;
}

function resolveColor(vars, key) {
  const raw = vars[key];
  if (!raw) return null;
  if (raw.startsWith('#')) return raw;
  const varRef = raw.match(/var\(([^)]+)\)/);
  if (varRef) {
    return resolveColor(vars, varRef[1]);
  }
  if (raw.startsWith('rgba')) return null;
  return null;
}

const css = readFileSync(themesPath, 'utf-8');
const themes = parseThemes(css);

let errors = 0;
let warnings = 0;

for (const [themeName, vars] of Object.entries(themes)) {
  console.log(`\n=== ${themeName} ===`);
  for (const pair of PAIRS) {
    const fg = resolveColor(vars, pair.fg);
    const bg = resolveColor(vars, pair.bg);
    if (!fg || !bg) {
      console.log(`  SKIP ${pair.label}: could not resolve colors (fg=${fg}, bg=${bg})`);
      warnings++;
      continue;
    }
    const ratio = contrastRatio(fg, bg);
    const pass = ratio >= WCAG_AA_THRESHOLD;
    const status = pass ? 'PASS' : 'FAIL';
    console.log(`  ${status} ${pair.label}: ${ratio.toFixed(2)}:1  (${fg} on ${bg})`);
    if (!pass) errors++;
  }
}

console.log(`\n${'='.repeat(40)}`);
if (errors > 0) {
  console.log(`FAIL: ${errors} pair(s) below ${WCAG_AA_THRESHOLD}:1 WCAG AA threshold`);
  process.exit(1);
} else {
  console.log(`PASS: All pairs meet ${WCAG_AA_THRESHOLD}:1 WCAG AA threshold`);
  if (warnings > 0) {
    console.log(`  (${warnings} pair(s) skipped due to unresolvable colors)`);
  }
}
