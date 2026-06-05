export interface TextComponent {
  text: string;
  translate?: string;
  with?: string[];
  extra?: TextComponent[];
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
  insertion?: string;
  clickEvent?: { action: string; value: string };
  hoverEvent?: { action: string; value: string | TextComponent };
}

export interface TextStyle {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
}

export const MC_COLOR_MAP: Record<string, string> = {
  black: '#000000',
  dark_blue: '#0000AA',
  dark_green: '#00AA00',
  dark_aqua: '#00AAAA',
  dark_red: '#AA0000',
  dark_purple: '#AA00AA',
  gold: '#FFAA00',
  gray: '#AAAAAA',
  dark_gray: '#555555',
  blue: '#5555FF',
  green: '#55FF55',
  aqua: '#55FFFF',
  red: '#FF5555',
  light_purple: '#FF55FF',
  yellow: '#FFFF55',
  white: '#FFFFFF',
  reset: '#FFFFFF',
};

const CODE_TO_COLOR: Record<string, string> = {
  '0': 'black', '1': 'dark_blue', '2': 'dark_green', '3': 'dark_aqua',
  '4': 'dark_red', '5': 'dark_purple', '6': 'gold', '7': 'gray',
  '8': 'dark_gray', '9': 'blue', 'a': 'green', 'b': 'aqua',
  'c': 'red', 'd': 'light_purple', 'e': 'yellow', 'f': 'white',
};

export function parseFormattedString(str: string): TextComponent {
  const firstCode = str.indexOf('\u00A7');
  if (firstCode === -1) {
    return { text: str };
  }

  const root: TextComponent = { text: str.substring(0, firstCode) };
  let builder = '';
  const style: TextStyle = {
    bold: false, obfuscated: false, strikethrough: false,
    underlined: false, italic: false, color: undefined,
  };

  for (let i = firstCode; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 0xA7 && i + 1 < str.length) {
      if (builder.length !== 0) {
        if (!root.extra) root.extra = [];
        root.extra.push({ text: builder, ...style });
        builder = '';
      }
      const formatChar = str.charAt(i + 1).toLowerCase();
      const colorName = CODE_TO_COLOR[formatChar];
      if (colorName) {
        style.color = colorName;
        style.bold = false; style.italic = false;
        style.underlined = false; style.strikethrough = false;
        style.obfuscated = false;
      } else {
        switch (formatChar) {
          case 'k': style.obfuscated = true; break;
          case 'l': style.bold = true; break;
          case 'm': style.strikethrough = true; break;
          case 'n': style.underlined = true; break;
          case 'o': style.italic = true; break;
          case 'r':
            style.bold = false; style.italic = false;
            style.underlined = false; style.strikethrough = false;
            style.obfuscated = false; style.color = undefined;
            break;
        }
      }
      i++;
    } else {
      builder += str[i];
    }
  }
  if (builder.length !== 0) {
    if (!root.extra) root.extra = [];
    root.extra.push({ text: builder, ...style });
  }
  return root;
}

export function toFormattedString(comp: TextComponent): string {
  let result = '';
  const parts = flatComponents(comp);
  for (const part of parts) {
    const text = part.text;
    if (text.length !== 0) {
      if (part.color && MC_COLOR_MAP[part.color]) {
        const idx = Object.keys(CODE_TO_COLOR).find(k => CODE_TO_COLOR[k] === part.color);
        if (idx) result += `\u00A7${idx}`;
      }
      if (part.bold) result += '\u00A7l';
      if (part.italic) result += '\u00A7o';
      if (part.underlined) result += '\u00A7n';
      if (part.strikethrough) result += '\u00A7m';
      if (part.obfuscated) result += '\u00A7k';
      result += text;
      result += '\u00A7r';
    }
  }
  return result;
}

function flatComponents(comp: TextComponent): TextComponent[] {
  const arr: TextComponent[] = [comp];
  if (comp.extra) {
    for (const child of comp.extra) {
      arr.push(...flatComponents(child));
    }
  }
  return arr;
}

export function resolveStyle(comp: TextComponent, parent?: TextStyle): TextStyle {
  return {
    color: comp.color ?? parent?.color,
    bold: comp.bold ?? parent?.bold ?? false,
    italic: comp.italic ?? parent?.italic ?? false,
    underlined: comp.underlined ?? parent?.underlined ?? false,
    strikethrough: comp.strikethrough ?? parent?.strikethrough ?? false,
    obfuscated: comp.obfuscated ?? parent?.obfuscated ?? false,
  };
}

export function styleToCSS(style: TextStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.color && MC_COLOR_MAP[style.color]) {
    css.color = MC_COLOR_MAP[style.color];
  }
  if (style.bold) css.fontWeight = 'bold';
  if (style.italic) css.fontStyle = 'italic';
  const decorations: string[] = [];
  if (style.underlined) decorations.push('underline');
  if (style.strikethrough) decorations.push('line-through');
  if (decorations.length > 0) css.textDecoration = decorations.join(' ');
  return css;
}
