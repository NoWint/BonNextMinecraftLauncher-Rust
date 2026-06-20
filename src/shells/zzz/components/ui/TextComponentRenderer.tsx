import { type ReactNode, useMemo } from 'react';
import {
  type TextComponent,
  type TextStyle,
  parseFormattedString,
  resolveStyle,
  styleToCSS,
} from '../../../../shared/utils/textComponent';
import styles from './TextComponentRenderer.module.css';

interface TextComponentRendererProps {
  component: TextComponent | string;
  className?: string;
}

export default function TextComponentRenderer({ component, className }: TextComponentRendererProps) {
  const parsed = useMemo(() => {
    if (typeof component === 'string') {
      if (component.includes('\u00A7')) {
        return parseFormattedString(component);
      }
      return { text: component };
    }
    return component;
  }, [component]);

  const nodes = renderNodes(parsed);
  return <span className={className}>{nodes}</span>;
}

function renderNodes(comp: TextComponent, parentStyle?: TextStyle): ReactNode[] {
  const style = resolveStyle(comp, parentStyle);
  const nodes: ReactNode[] = [];

  if (comp.text) {
    const css = styleToCSS(style);
    const isObfuscated = style.obfuscated;
    nodes.push(
      <span
        key={comp.text.slice(0, 20) + nodes.length}
        style={css}
        className={isObfuscated ? styles.obfuscated : undefined}
      >
        {comp.text}
      </span>
    );
  }

  if (comp.extra) {
    for (let i = 0; i < comp.extra.length; i++) {
      nodes.push(...renderNodes(comp.extra[i], style));
    }
  }

  return nodes;
}
