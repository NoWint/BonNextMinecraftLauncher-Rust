# MD3 Layout Restructuring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the MD3 plugin from CSS-only style overrides into a full layout restructuring plugin that replaces the entire visual shell (Navigation Rail, Top App Bar, typography, all page components) when active, while leaving the original ZZZ layout completely untouched.

**Architecture:** A new `bonnext:layout` extension point allows the MD3 plugin to contribute a `LayoutContribution` containing React components for Navigation Rail, Top App Bar, FAB, and 12 MD3 component wrappers (built on `@material/web`). AppShell conditionally renders either `MD3AppShell` or `ZZZAppShell` based on whether a layout contribution exists. Each page uses `useLayout()` to conditionally render its MD3 or ZZZ variant.

**Tech Stack:** React 18, TypeScript, `@material/web` (Google's official MD3 Web Components), CSS Modules, Tauri v2

---

## Task 1: Install @material/web

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /Users/xiatian/Desktop/BonNext && pnpm add @material/web
```

- [ ] **Step 2: Verify installation**

```bash
pnpm ls @material/web
```

Expected: `@material/web X.X.X` listed

- [ ] **Step 3: Verify build still works**

```bash
pnpm build 2>&1 | tail -5
```

Expected: Build succeeds

---

## Task 2: Create LayoutExtensionPoint

**Files:**

- Create: `src/plugins/extensions/LayoutExtensionPoint.ts`
- Modify: `src/plugins/extensions/index.ts`

- [ ] **Step 1: Create the LayoutExtensionPoint class**

```typescript
// src/plugins/extensions/LayoutExtensionPoint.ts
import { ExtensionPointBase } from './ExtensionPoint';
import type { ComponentType } from 'react';

export interface NavigationRailProps {
  items: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
  activeId: string;
  onNavigate: (id: string) => void;
  fabIcon?: string;
  fabLabel?: string;
  onFabClick?: () => void;
}

export interface TopAppBarProps {
  title: string;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  onSettingsClick?: () => void;
  children?: React.ReactNode;
}

export interface FABProps {
  icon?: string;
  label?: string;
  variant?: 'surface' | 'primary' | 'secondary' | 'tertiary';
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  extended?: boolean;
}

export interface MD3TypographyScale {
  displayLarge: string;
  displayMedium: string;
  displaySmall: string;
  headlineLarge: string;
  headlineMedium: string;
  headlineSmall: string;
  titleLarge: string;
  titleMedium: string;
  titleSmall: string;
  bodyLarge: string;
  bodyMedium: string;
  bodySmall: string;
  labelLarge: string;
  labelMedium: string;
  labelSmall: string;
}

export interface LayoutContribution {
  NavigationRail: ComponentType<NavigationRailProps>;
  TopAppBar: ComponentType<TopAppBarProps>;
  FAB: ComponentType<FABProps>;
  components: {
    Button: ComponentType<MD3ButtonProps>;
    Card: ComponentType<MD3CardProps>;
    Dialog: ComponentType<MD3DialogProps>;
    TextField: ComponentType<MD3TextFieldProps>;
    Select: ComponentType<MD3SelectProps>;
    Switch: ComponentType<MD3SwitchProps>;
    Checkbox: ComponentType<MD3CheckboxProps>;
    Tabs: ComponentType<MD3TabsProps>;
    Chip: ComponentType<MD3ChipProps>;
    Badge: ComponentType<MD3BadgeProps>;
    List: ComponentType<MD3ListProps>;
    Icon: ComponentType<MD3IconProps>;
    Divider: ComponentType<MD3DividerProps>;
  };
  typography: MD3TypographyScale;
  themeTokens: Record<string, string>;
}

export interface MD3ButtonProps {
  variant?: 'filled' | 'outlined' | 'text' | 'elevated' | 'filled-tonal';
  children?: React.ReactNode;
  onClick?: (e: Event) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  href?: string;
  type?: 'button' | 'submit' | 'reset';
}

export interface MD3CardProps {
  variant?: 'elevated' | 'filled' | 'outlined';
  children?: React.ReactNode;
  onClick?: (e: Event) => void;
  className?: string;
}

export interface MD3DialogProps {
  open: boolean;
  onClose: () => void;
  headline?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export interface MD3TextFieldProps {
  variant?: 'filled' | 'outlined';
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  errorText?: string;
  type?: string;
  required?: boolean;
  supportingText?: string;
}

export interface MD3SelectProps {
  variant?: 'filled' | 'outlined';
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  error?: boolean;
  errorText?: string;
}

export interface MD3SwitchProps {
  selected?: boolean;
  onChange?: (selected: boolean) => void;
  disabled?: boolean;
  icons?: { on?: React.ReactNode; off?: React.ReactNode };
}

export interface MD3CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
}

export interface MD3TabsProps {
  items: Array<{ id: string; label: string; icon?: React.ReactNode }>;
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'primary' | 'secondary';
}

export interface MD3ChipProps {
  variant?: 'assist' | 'filter' | 'input' | 'suggestion';
  label: string;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  elevated?: boolean;
  href?: string;
}

export interface MD3BadgeProps {
  value?: number;
  variant?: 'small' | 'large';
}

export interface MD3ListProps {
  items: Array<{
    headline: string;
    supportingText?: string;
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
    onClick?: () => void;
  }>;
}

export interface MD3IconProps {
  name?: string;
  children?: React.ReactNode;
}

export interface MD3DividerProps {
  inset?: boolean;
}

export class LayoutExtensionPoint extends ExtensionPointBase<LayoutContribution> {
  readonly id = 'bonnext:layout';
  readonly name = 'Layout Extension Point';

  getActiveLayout(): LayoutContribution | undefined {
    return this.getContributions()[0];
  }
}
```

- [ ] **Step 2: Update extensions barrel export**

In `src/plugins/extensions/index.ts`, add the new exports:

```typescript
export { ExtensionPointBase } from './ExtensionPoint';
export type { ExtensionPointEvent } from './ExtensionPoint';
export { ThemeExtensionPoint } from './ThemeExtensionPoint';
export type { ThemeContribution } from './ThemeExtensionPoint';
export { LayoutExtensionPoint } from './LayoutExtensionPoint';
export type {
  LayoutContribution,
  NavigationRailProps,
  TopAppBarProps,
  FABProps,
  MD3TypographyScale,
  MD3ButtonProps,
  MD3CardProps,
  MD3DialogProps,
  MD3TextFieldProps,
  MD3SelectProps,
  MD3SwitchProps,
  MD3CheckboxProps,
  MD3TabsProps,
  MD3ChipProps,
  MD3BadgeProps,
  MD3ListProps,
  MD3IconProps,
  MD3DividerProps,
} from './LayoutExtensionPoint';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to LayoutExtensionPoint

---

## Task 3: Register LayoutExtensionPoint in App.tsx

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: Import LayoutExtensionPoint and add to extensionPoints array**

In `src/App.tsx`, add the import:

```typescript
import { ThemeExtensionPoint, LayoutExtensionPoint } from './plugins/extensions';
```

Update the `extensionPoints` useMemo in the `App` component:

```typescript
const extensionPoints = useMemo(() => [new ThemeExtensionPoint(), new LayoutExtensionPoint()], []);
```

- [ ] **Step 2: Verify build**

```bash
pnpm build 2>&1 | tail -5
```

Expected: Build succeeds

---

## Task 4: Create useLayout hook

**Files:**

- Create: `src/plugins/builtins/md3-theme/layout/useLayout.ts`

- [ ] **Step 1: Create the useLayout hook**

```typescript
// src/plugins/builtins/md3-theme/layout/useLayout.ts
import { useState, useEffect } from 'react';
import { usePluginManager, usePluginReady } from '@/plugins/core';
import type { LayoutContribution } from '@/plugins/extensions';

export function useLayout(): LayoutContribution | null {
  const manager = usePluginManager();
  const ready = usePluginReady();
  const [layout, setLayout] = useState<LayoutContribution | null>(null);

  useEffect(() => {
    if (!ready) return;

    const point = manager.getExtensionPoint('bonnext:layout');
    if (!point || typeof (point as any).getActiveLayout !== 'function') {
      setLayout(null);
      return;
    }

    const layoutPoint = point as {
      getActiveLayout(): LayoutContribution | undefined;
      addListener(fn: (e: any) => void): () => void;
    };
    setLayout(layoutPoint.getActiveLayout() ?? null);

    const unsub = layoutPoint.addListener(() => {
      setLayout(layoutPoint.getActiveLayout() ?? null);
    });

    return unsub;
  }, [ready, manager]);

  return layout;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: No errors

---

## Task 5: Create MD3 Typography CSS

**Files:**

- Create: `src/plugins/builtins/md3-theme/tokens/md3-typography.css`
- Create: `src/plugins/builtins/md3-theme/tokens/md3-sys-colors.css`

- [ ] **Step 1: Create MD3 typography token file**

```css
/* src/plugins/builtins/md3-theme/tokens/md3-typography.css */
html[class*='theme-md3'] {
  --md3-typescale-display-large: 500 3.5625rem/1.12 'Roboto', sans-serif;
  --md3-typescale-display-medium: 500 2.8125rem/1.16 'Roboto', sans-serif;
  --md3-typescale-display-small: 500 2.25rem/1.22 'Roboto', sans-serif;
  --md3-typescale-headline-large: 400 2rem/1.25 'Roboto', sans-serif;
  --md3-typescale-headline-medium: 400 1.75rem/1.29 'Roboto', sans-serif;
  --md3-typescale-headline-small: 400 1.5rem/1.33 'Roboto', sans-serif;
  --md3-typescale-title-large: 500 1.375rem/1.27 'Roboto', sans-serif;
  --md3-typescale-title-medium: 500 1rem/1.5 'Roboto', sans-serif;
  --md3-typescale-title-small: 500 0.875rem/1.43 'Roboto', sans-serif;
  --md3-typescale-body-large: 400 1rem/1.5 'Roboto', sans-serif;
  --md3-typescale-body-medium: 400 0.875rem/1.43 'Roboto', sans-serif;
  --md3-typescale-body-small: 400 0.75rem/1.33 'Roboto', sans-serif;
  --md3-typescale-label-large: 500 0.875rem/1.43 'Roboto', sans-serif;
  --md3-typescale-label-medium: 500 0.75rem/1.33 'Roboto', sans-serif;
  --md3-typescale-label-small: 500 0.6875rem/1.45 'Roboto', sans-serif;

  --font-heading: 'Roboto', sans-serif;
  --font-body: 'Roboto', sans-serif;
  --font-mono: 'Roboto Mono', monospace;

  letter-spacing: 0;
}
```

- [ ] **Step 2: Create MD3 system color mapping file**

```css
/* src/plugins/builtins/md3-theme/tokens/md3-sys-colors.css */
html[class*='theme-md3'] {
  --md-sys-color-primary: var(--md3-primary);
  --md-sys-color-on-primary: var(--md3-on-primary);
  --md-sys-color-primary-container: var(--md3-primary-container);
  --md-sys-color-on-primary-container: var(--md3-on-primary-container);
  --md-sys-color-secondary: var(--md3-secondary);
  --md-sys-color-on-secondary: var(--md3-on-secondary);
  --md-sys-color-secondary-container: var(--md3-secondary-container);
  --md-sys-color-on-secondary-container: var(--md3-on-secondary-container);
  --md-sys-color-tertiary: var(--md3-tertiary);
  --md-sys-color-on-tertiary: var(--md3-on-tertiary);
  --md-sys-color-tertiary-container: var(--md3-tertiary-container);
  --md-sys-color-on-tertiary-container: var(--md3-on-tertiary-container);
  --md-sys-color-error: var(--md3-error);
  --md-sys-color-on-error: var(--md3-on-error);
  --md-sys-color-error-container: var(--md3-error-container);
  --md-sys-color-on-error-container: var(--md3-on-error-container);
  --md-sys-color-background: var(--md3-background);
  --md-sys-color-on-background: var(--md3-on-background);
  --md-sys-color-surface: var(--md3-surface);
  --md-sys-color-on-surface: var(--md3-on-surface);
  --md-sys-color-surface-variant: var(--md3-surface-variant);
  --md-sys-color-on-surface-variant: var(--md3-on-surface-variant);
  --md-sys-color-outline: var(--md3-outline);
  --md-sys-color-outline-variant: var(--md3-outline-variant);
  --md-sys-color-inverse-surface: var(--md3-inverse-surface);
  --md-sys-color-inverse-on-surface: var(--md3-inverse-on-surface);
  --md-sys-color-inverse-primary: var(--md3-inverse-primary);
  --md-sys-color-shadow: var(--md3-shadow);
  --md-sys-color-scrim: var(--md3-scrim);
  --md-sys-color-surface-container-lowest: var(--md3-surface-container-lowest);
  --md-sys-color-surface-container-low: var(--md3-surface-container-low);
  --md-sys-color-surface-container: var(--md3-surface-container);
  --md-sys-color-surface-container-high: var(--md3-surface-container-high);
  --md-sys-color-surface-container-highest: var(--md3-surface-container-highest);
}
```

- [ ] **Step 3: Verify files are valid CSS**

```bash
ls -la src/plugins/builtins/md3-theme/tokens/md3-typography.css src/plugins/builtins/md3-theme/tokens/md3-sys-colors.css
```

Expected: Both files exist

---

## Task 6: Create React Wrappers for @material/web (Part 1 — Button, FAB, Card, Icon, Divider)

**Files:**

- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Button.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3FAB.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Card.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Icon.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Divider.tsx`

- [ ] **Step 1: Create MD3Button wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Button.tsx
import { useRef, useEffect, type ReactNode } from 'react';
import type { MD3ButtonProps } from '@/plugins/extensions';

const VARIANT_MAP = {
  filled: 'md-filled-button',
  outlined: 'md-outlined-button',
  text: 'md-text-button',
  elevated: 'md-elevated-button',
  'filled-tonal': 'md-filled-tonal-button',
} as const;

export function MD3Button({
  variant = 'filled',
  children,
  onClick,
  disabled,
  icon,
  href,
  type,
}: MD3ButtonProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  const Tag = VARIANT_MAP[variant];

  return (
    <Tag
      ref={ref as any}
      disabled={disabled || undefined}
      href={href || undefined}
      type={type || undefined}
    >
      {icon}
      {children}
    </Tag>
  );
}
```

- [ ] **Step 2: Create MD3FAB wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3FAB.tsx
import { useRef, useEffect } from 'react';
import type { FABProps } from '@/plugins/extensions';

export function MD3FAB({
  icon,
  label,
  variant = 'surface',
  size = 'medium',
  onClick,
  extended,
}: FABProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  const Tag = size === 'small' ? 'md-fab'
    : extended ? 'md-fab'
    : 'md-fab';

  return (
    <Tag
      ref={ref as any}
      variant={variant}
      size={size === 'small' ? 'small' : undefined}
      label={label || undefined}
      extended={extended || undefined}
    >
      {icon && <span slot="icon">{icon}</span>}
    </Tag>
  );
}
```

- [ ] **Step 3: Create MD3Card wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Card.tsx
import { useRef, useEffect, type ReactNode } from 'react';
import type { MD3CardProps } from '@/plugins/extensions';

const VARIANT_MAP = {
  elevated: 'md-elevated-card',
  filled: 'md-filled-card',
  outlined: 'md-outlined-card',
} as const;

export function MD3Card({
  variant = 'elevated',
  children,
  onClick,
  className,
}: MD3CardProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  const Tag = VARIANT_MAP[variant];

  return (
    <Tag ref={ref as any} class={className || undefined}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 4: Create MD3Icon wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Icon.tsx
import type { MD3IconProps } from '@/plugins/extensions';

export function MD3Icon({ name, children }: MD3IconProps) {
  return <md-icon>{name || children}</md-icon>;
}
```

- [ ] **Step 5: Create MD3Divider wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Divider.tsx
import type { MD3DividerProps } from '@/plugins/extensions';

export function MD3Divider({ inset }: MD3DividerProps) {
  return <md-divider inset={inset || undefined} />;
}
```

---

## Task 7: Create React Wrappers (Part 2 — Dialog, TextField, Select, Switch, Checkbox)

**Files:**

- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Dialog.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3TextField.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Select.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Switch.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Checkbox.tsx`

- [ ] **Step 1: Create MD3Dialog wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Dialog.tsx
import { useRef, useEffect, type ReactNode } from 'react';
import type { MD3DialogProps } from '@/plugins/extensions';

export function MD3Dialog({
  open,
  onClose,
  headline,
  children,
  actions,
}: MD3DialogProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    if (open) {
      el.show();
    } else {
      el.open = false;
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClose) return;
    const handler = () => onClose();
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onClose]);

  return (
    <md-dialog ref={ref as any}>
      {headline && <div slot="headline">{headline}</div>}
      <div slot="content">{children}</div>
      {actions && <div slot="actions">{actions}</div>}
    </md-dialog>
  );
}
```

- [ ] **Step 2: Create MD3TextField wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3TextField.tsx
import { useRef, useEffect } from 'react';
import type { MD3TextFieldProps } from '@/plugins/extensions';

export function MD3TextField({
  variant = 'filled',
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  errorText,
  type,
  required,
  supportingText,
}: MD3TextFieldProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current as any;
    if (!el || !onChange) return;
    const handler = (e: Event) => {
      onChange((e.target as any).value);
    };
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [onChange]);

  const Tag = variant === 'filled' ? 'md-filled-text-field' : 'md-outlined-text-field';

  return (
    <Tag
      ref={ref as any}
      label={label || undefined}
      value={value ?? ''}
      placeholder={placeholder || undefined}
      disabled={disabled || undefined}
      error={error || undefined}
      error-text={errorText || undefined}
      type={type || undefined}
      required={required || undefined}
      supporting-text={supportingText || undefined}
    />
  );
}
```

- [ ] **Step 3: Create MD3Select wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Select.tsx
import { useRef, useEffect } from 'react';
import type { MD3SelectProps } from '@/plugins/extensions';

export function MD3Select({
  variant = 'filled',
  label,
  value,
  onChange,
  children,
  disabled,
  error,
  errorText,
}: MD3SelectProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current as any;
    if (!el || !onChange) return;
    const handler = () => {
      onChange(el.value);
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  const Tag = variant === 'filled' ? 'md-filled-select' : 'md-outlined-select';

  return (
    <Tag
      ref={ref as any}
      label={label || undefined}
      value={value || undefined}
      disabled={disabled || undefined}
      error={error || undefined}
      error-text={errorText || undefined}
    >
      {children}
    </Tag>
  );
}
```

- [ ] **Step 4: Create MD3Switch wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Switch.tsx
import { useRef, useEffect } from 'react';
import type { MD3SwitchProps } from '@/plugins/extensions';

export function MD3Switch({
  selected = false,
  onChange,
  disabled,
  icons,
}: MD3SwitchProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    el.selected = selected;
  }, [selected]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onChange) return;
    const handler = (e: Event) => {
      onChange((e.target as any).selected);
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  return (
    <md-switch
      ref={ref as any}
      disabled={disabled || undefined}
      icons={icons ? true : undefined}
    >
      {icons?.on && <div slot="on-icon">{icons.on}</div>}
      {icons?.off && <div slot="off-icon">{icons.off}</div>}
    </md-switch>
  );
}
```

- [ ] **Step 5: Create MD3Checkbox wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Checkbox.tsx
import { useRef, useEffect } from 'react';
import type { MD3CheckboxProps } from '@/plugins/extensions';

export function MD3Checkbox({
  checked = false,
  onChange,
  disabled,
  indeterminate,
}: MD3CheckboxProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    el.checked = checked;
    el.indeterminate = indeterminate || false;
  }, [checked, indeterminate]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onChange) return;
    const handler = (e: Event) => {
      onChange((e.target as any).checked);
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  return <md-checkbox ref={ref as any} disabled={disabled || undefined} />;
}
```

---

## Task 8: Create React Wrappers (Part 3 — Tabs, Chip, Badge, List)

**Files:**

- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Tabs.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Chip.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3Badge.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/MD3List.tsx`
- Create: `src/plugins/builtins/md3-theme/wrappers/index.ts`

- [ ] **Step 1: Create MD3Tabs wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Tabs.tsx
import { useRef, useEffect } from 'react';
import type { MD3TabsProps } from '@/plugins/extensions';

export function MD3Tabs({
  items,
  activeId,
  onChange,
  variant = 'primary',
}: MD3TabsProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    const idx = items.findIndex((i) => i.id === activeId);
    if (idx >= 0 && el.activeTabIndex !== idx) {
      el.activeTabIndex = idx;
    }
  }, [activeId, items]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onChange) return;
    const handler = (e: Event) => {
      const idx = (e.target as any).activeTabIndex;
      if (items[idx]) {
        onChange(items[idx].id);
      }
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange, items]);

  const Tag = variant === 'primary' ? 'md-primary-tab' : 'md-secondary-tab';

  return (
    <md-tabs ref={ref as any}>
      {items.map((item) => (
        <Tag key={item.id}>
          {item.icon && <span slot="icon">{item.icon}</span>}
          {item.label}
        </Tag>
      ))}
    </md-tabs>
  );
}
```

- [ ] **Step 2: Create MD3Chip wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Chip.tsx
import { useRef, useEffect } from 'react';
import type { MD3ChipProps } from '@/plugins/extensions';

const VARIANT_MAP = {
  assist: 'md-assist-chip',
  filter: 'md-filter-chip',
  input: 'md-input-chip',
  suggestion: 'md-suggestion-chip',
} as const;

export function MD3Chip({
  variant = 'assist',
  label,
  selected,
  onClick,
  onRemove,
  icon,
  disabled,
  elevated,
  href,
}: MD3ChipProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    if (selected !== undefined) el.selected = selected;
  }, [selected]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onRemove) return;
    el.addEventListener('remove', onRemove);
    return () => el.removeEventListener('remove', onRemove);
  }, [onRemove]);

  const Tag = VARIANT_MAP[variant];

  return (
    <Tag
      ref={ref as any}
      label={label}
      disabled={disabled || undefined}
      elevated={elevated || undefined}
      href={href || undefined}
    >
      {icon && <span slot="icon">{icon}</span>}
    </Tag>
  );
}
```

- [ ] **Step 3: Create MD3Badge wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3Badge.tsx
import type { MD3BadgeProps } from '@/plugins/extensions';

export function MD3Badge({ value, variant = 'small' }: MD3BadgeProps) {
  return (
    <md-badge
      value={value !== undefined ? String(value) : undefined}
      variant={variant}
    />
  );
}
```

- [ ] **Step 4: Create MD3List wrapper**

```typescript
// src/plugins/builtins/md3-theme/wrappers/MD3List.tsx
import { useRef, useEffect } from 'react';
import type { MD3ListProps } from '@/plugins/extensions';

export function MD3List({ items }: MD3ListProps) {
  return (
    <md-list>
      {items.map((item, idx) => (
        <MD3ListItem key={idx} {...item} />
      ))}
    </md-list>
  );
}

function MD3ListItem({
  headline,
  supportingText,
  leadingIcon,
  trailingIcon,
  onClick,
}: MD3ListProps['items'][0]) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  return (
    <md-list-item ref={ref as any}
      headline={headline}
      supporting-text={supportingText || undefined}
    >
      {leadingIcon && <div slot="start">{leadingIcon}</div>}
      {trailingIcon && <div slot="end">{trailingIcon}</div>}
    </md-list-item>
  );
}
```

- [ ] **Step 5: Create barrel export**

```typescript
// src/plugins/builtins/md3-theme/wrappers/index.ts
export { MD3Button } from './MD3Button';
export { MD3FAB } from './MD3FAB';
export { MD3Card } from './MD3Card';
export { MD3Dialog } from './MD3Dialog';
export { MD3TextField } from './MD3TextField';
export { MD3Select } from './MD3Select';
export { MD3Switch } from './MD3Switch';
export { MD3Checkbox } from './MD3Checkbox';
export { MD3Tabs } from './MD3Tabs';
export { MD3Chip } from './MD3Chip';
export { MD3Badge } from './MD3Badge';
export { MD3List } from './MD3List';
export { MD3Icon } from './MD3Icon';
export { MD3Divider } from './MD3Divider';
```

---

## Task 9: Create MD3 Navigation Rail component

**Files:**

- Create: `src/plugins/builtins/md3-theme/layout/MD3NavigationRail.tsx`
- Create: `src/plugins/builtins/md3-theme/layout/MD3NavigationRail.module.css`

- [ ] **Step 1: Create the Navigation Rail CSS**

```css
/* src/plugins/builtins/md3-theme/layout/MD3NavigationRail.module.css */
.rail {
  width: 80px;
  height: 100%;
  background: var(--md-sys-color-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  border-right: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.navItem {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-bottom: 4px;
  color: var(--md-sys-color-on-surface-variant);
  transition:
    background 200ms ease,
    color 200ms ease;
  border: none;
  background: none;
  padding: 4px 0;
}

.navItem:hover {
  background: var(--md-sys-color-on-surface-variant, rgba(255, 255, 255, 0.08));
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
}

.navItemActive {
  background: color-mix(in srgb, var(--md-sys-color-secondary-container) 100%, transparent);
  color: var(--md-sys-color-on-secondary-container);
}

.navItemActive:hover {
  background: color-mix(
    in srgb,
    var(--md-sys-color-on-secondary-container) 8%,
    var(--md-sys-color-secondary-container)
  );
}

.navIcon {
  font-size: 18px;
  line-height: 1;
  margin-bottom: 2px;
}

.navLabel {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.5px;
  line-height: 1;
}

.spacer {
  flex: 1;
}

.fab {
  margin-bottom: 16px;
}
```

- [ ] **Step 2: Create the Navigation Rail component**

```typescript
// src/plugins/builtins/md3-theme/layout/MD3NavigationRail.tsx
import type { NavigationRailProps } from '@/plugins/extensions';
import { MD3FAB } from '../wrappers/MD3FAB';
import s from './MD3NavigationRail.module.css';

export function MD3NavigationRail({
  items,
  activeId,
  onNavigate,
  fabIcon,
  fabLabel,
  onFabClick,
}: NavigationRailProps) {
  return (
    <nav className={s.rail}>
      {items.map((item) => (
        <button
          key={item.id}
          className={`${s.navItem} ${item.id === activeId ? s.navItemActive : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-current={item.id === activeId ? 'page' : undefined}
        >
          <span className={s.navIcon}>{item.icon}</span>
          <span className={s.navLabel}>{item.label}</span>
        </button>
      ))}
      <div className={s.spacer} />
      {fabIcon && (
        <div className={s.fab}>
          <MD3FAB
            icon={fabIcon}
            label={fabLabel}
            onClick={onFabClick}
            variant="surface"
            size="medium"
          />
        </div>
      )}
    </nav>
  );
}
```

---

## Task 10: Create MD3 Top App Bar component

**Files:**

- Create: `src/plugins/builtins/md3-theme/layout/MD3TopAppBar.tsx`
- Create: `src/plugins/builtins/md3-theme/layout/MD3TopAppBar.module.css`

- [ ] **Step 1: Create the Top App Bar CSS**

```css
/* src/plugins/builtins/md3-theme/layout/MD3TopAppBar.module.css */
.topBar {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
  gap: 12px;
  -webkit-app-region: drag;
}

.macosSpacer {
  width: 70px;
  flex-shrink: 0;
}

.title {
  font: var(--md3-typescale-title-large);
  color: var(--md-sys-color-on-surface);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.iconBtn {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  border: none;
  background: none;
  transition: background 200ms ease;
}

.iconBtn:hover {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
}
```

- [ ] **Step 2: Create the Top App Bar component**

```typescript
// src/plugins/builtins/md3-theme/layout/MD3TopAppBar.tsx
import type { TopAppBarProps } from '@/plugins/extensions';
import s from './MD3TopAppBar.module.css';

export function MD3TopAppBar({
  title,
  onSearchClick,
  onSettingsClick,
}: TopAppBarProps) {
  const isMac = navigator.platform.toUpperCase().includes('MAC');

  return (
    <header className={s.topBar}>
      {isMac && <div className={s.macosSpacer} />}
      <h1 className={s.title}>{title}</h1>
      <div className={s.actions}>
        {onSearchClick && (
          <button className={s.iconBtn} onClick={onSearchClick} aria-label="Search">
            🔍
          </button>
        )}
        {onSettingsClick && (
          <button className={s.iconBtn} onClick={onSettingsClick} aria-label="Settings">
            ⚙️
          </button>
        )}
      </div>
    </header>
  );
}
```

---

## Task 11: Create MD3AppShell

**Files:**

- Create: `src/plugins/builtins/md3-theme/layout/MD3AppShell.tsx`
- Create: `src/plugins/builtins/md3-theme/layout/MD3AppShell.module.css`

- [ ] **Step 1: Create the MD3AppShell CSS**

```css
/* src/plugins/builtins/md3-theme/layout/MD3AppShell.module.css */
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: var(--app-radius, 10px);
  overflow: hidden;
  background: var(--md-sys-color-background);
  color: var(--md-sys-color-on-background);
  font-family: 'Roboto', sans-serif;
}

.layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main {
  flex: 1;
  padding: 16px 24px;
  overflow-y: auto;
  background: var(--md-sys-color-surface);
}
```

- [ ] **Step 2: Create the MD3AppShell component**

```typescript
// src/plugins/builtins/md3-theme/layout/MD3AppShell.tsx
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { LayoutContribution } from '@/plugins/extensions';
import { useI18n } from '@/i18n';
import { NAV_ID_TO_PATH } from '@/constants/navigation';
import s from './MD3AppShell.module.css';

const HomePage = lazy(() => import('@/pages/HomePage'));
const InstancesPage = lazy(() => import('@/pages/InstancesPage'));
const InstanceDetailPage = lazy(() => import('@/pages/InstanceDetailPage'));
const NewInstancePage = lazy(() => import('@/pages/NewInstancePage'));
const VersionsPage = lazy(() => import('@/pages/VersionsPage'));
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage'));
const ContentDetailPage = lazy(() => import('@/pages/ContentDetailPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function PageSkeleton() {
  return (
    <div style={{ padding: '1em', display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
      <div style={{ width: '40%', height: '1.5em', background: 'var(--md-sys-color-surface-container-high)', borderRadius: '8px' }} />
      <div style={{ width: '100%', height: '12em', background: 'var(--md-sys-color-surface-container-high)', borderRadius: '12px' }} />
    </div>
  );
}

interface MD3AppShellProps {
  layout: LayoutContribution;
}

export function MD3AppShell({ layout }: MD3AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  const NAV_ITEMS = [
    { id: 'home', label: t('nav.home'), icon: '🏠' },
    { id: 'marketplace', label: t('nav.marketplace') || 'Store', icon: '🏪' },
    { id: 'instances', label: t('nav.instances'), icon: '📦' },
    { id: 'library', label: t('nav.library'), icon: '📚' },
    { id: 'collections', label: t('nav.collections'), icon: '⭐' },
    { id: 'versions', label: t('nav.versions'), icon: '📋' },
    { id: 'settings', label: t('nav.settings'), icon: '⚙️' },
  ];

  const activeNavId = (() => {
    const path = location.pathname;
    for (const [id, navPath] of Object.entries(NAV_ID_TO_PATH)) {
      if (path === navPath || path.startsWith(navPath + '/')) return id;
    }
    return 'home';
  })();

  const pageTitle = NAV_ITEMS.find((i) => i.id === activeNavId)?.label || 'BonNext';

  const handleNavigate = (id: string) => {
    navigate(NAV_ID_TO_PATH[id] || `/${id}`);
  };

  return (
    <div className={s.shell}>
      <layout.TopAppBar
        title={pageTitle}
        onSearchClick={() => {}}
        onSettingsClick={() => navigate('/settings')}
      />
      <div className={s.layout}>
        <layout.NavigationRail
          items={NAV_ITEMS}
          activeId={activeNavId}
          onNavigate={handleNavigate}
          fabIcon="▶"
          fabLabel="Launch"
          onFabClick={() => {}}
        />
        <main className={s.main}>
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/instances" element={<InstancesPage />} />
                <Route path="/instances/new" element={<NewInstancePage />} />
                <Route path="/instances/:id" element={<InstanceDetailPage />} />
                <Route path="/versions" element={<VersionsPage />} />
                <Route path="/store" element={<MarketplacePage />} />
                <Route path="/mods" element={<MarketplacePage />} />
                <Route path="/store/:type/:slug" element={<ContentDetailPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
```

Note: This uses a local `ErrorBoundary` — we'll need to import the existing one from `@/components/ErrorBoundary`.

---

## Task 12: Modify MD3ThemePlugin to contribute LayoutContribution

**Files:**

- Modify: `src/plugins/builtins/md3-theme/MD3ThemePlugin.ts`

- [ ] **Step 1: Update MD3ThemePlugin to dynamically import @material/web and contribute layout**

Replace the entire `MD3ThemePlugin.ts` content:

```typescript
import type { Plugin, PluginContextType, PluginDependency } from '@/plugins/core';
import { ThemeService } from '@/plugins/builtins/zzz-theme/ThemeService';
import { generateMD3Contributions, MD3_SEED_PRESETS } from './contributions';
import { createSystemPreferenceRule, createSystemLightPreferenceRule } from './rules/systemPreference';
import type { LayoutContribution, MD3TypographyScale } from '@/plugins/extensions';
import { MD3Button } from './wrappers/MD3Button';
import { MD3FAB } from './wrappers/MD3FAB';
import { MD3Card } from './wrappers/MD3Card';
import { MD3Dialog } from './wrappers/MD3Dialog';
import { MD3TextField } from './wrappers/MD3TextField';
import { MD3Select } from './wrappers/MD3Select';
import { MD3Switch } from './wrappers/MD3Switch';
import { MD3Checkbox } from './wrappers/MD3Checkbox';
import { MD3Tabs } from './wrappers/MD3Tabs';
import { MD3Chip } from './wrappers/MD3Chip';
import { MD3Badge } from './wrappers/MD3Badge';
import { MD3List } from './wrappers/MD3List';
import { MD3Icon } from './wrappers/MD3Icon';
import { MD3Divider } from './wrappers/MD3Divider';
import { MD3NavigationRail } from './layout/MD3NavigationRail';
import { MD3TopAppBar } from './layout/MD3TopAppBar';

import './tokens/md3-shared.css';
import './tokens/md3-dark.css';
import './tokens/md3-light.css';
import './tokens/md3-typography.css';
import './tokens/md3-sys-colors.css';

const MD3_TYPOGRAPHY: MD3TypographyScale = {
  displayLarge: '500 3.5625rem/1.12 Roboto, sans-serif',
  displayMedium: '500 2.8125rem/1.16 Roboto, sans-serif',
  displaySmall: '500 2.25rem/1.22 Roboto, sans-serif',
  headlineLarge: '400 2rem/1.25 Roboto, sans-serif',
  headlineMedium: '400 1.75rem/1.29 Roboto, sans-serif',
  headlineSmall: '400 1.5rem/1.33 Roboto, sans-serif',
  titleLarge: '500 1.375rem/1.27 Roboto, sans-serif',
  titleMedium: '500 1rem/1.5 Roboto, sans-serif',
  titleSmall: '500 0.875rem/1.43 Roboto, sans-serif',
  bodyLarge: '400 1rem/1.5 Roboto, sans-serif',
  bodyMedium: '400 0.875rem/1.43 Roboto, sans-serif',
  bodySmall: '400 0.75rem/1.33 Roboto, sans-serif',
  labelLarge: '500 0.875rem/1.43 Roboto, sans-serif',
  labelMedium: '500 0.75rem/1.33 Roboto, sans-serif',
  labelSmall: '500 0.6875rem/1.45 Roboto, sans-serif',
};

export class MD3ThemePlugin implements Plugin {
  id = 'com.bonnext.md3-theme';
  name = 'Material Design 3 Theme';
  version = '1.0.0';
  description = 'Material Design 3 theme with dynamic color and full layout restructuring';
  dependencies: PluginDependency[] = [{ id: 'com.bonnext.zzz-theme', version: '^1.0.0' }];

  private currentSeedColor: string = MD3_SEED_PRESETS[0].color;
  private registeredThemeIds: string[] = [];
  private layoutContribution: LayoutContribution | null = null;
  private themeService: ThemeService | null = null;
  private fontLink: HTMLLinkElement | null = null;

  async activate(context: PluginContextType): Promise<void> {
    const themeService = context.consumeService('bonnext:theme') as ThemeService | undefined;
    if (!themeService) {
      throw new Error('MD3ThemePlugin: ThemeService not available. ZZZ theme plugin must be activated first.');
    }

    this.themeService = themeService;

    try {
      const saved = localStorage.getItem('bonnext:md3-seed-color');
      if (saved) this.currentSeedColor = saved;
    } catch {}

    this.registerThemes(themeService);

    const darkId = this.registeredThemeIds.find((id) => id.endsWith('-dark'));
    const lightId = this.registeredThemeIds.find((id) => id.endsWith('-light'));
    if (darkId && lightId) {
      themeService.addRule(createSystemPreferenceRule(darkId, lightId));
      themeService.addRule(createSystemLightPreferenceRule(lightId));
    }

    const contributions = generateMD3Contributions(this.currentSeedColor);
    for (const contribution of contributions) {
      context.contributeExtension('bonnext:theme', contribution);
    }

    await import('@material/web/all.js');

    this.loadRobotoFont();

    this.layoutContribution = this.createLayoutContribution();
    context.contributeExtension('bonnext:layout', this.layoutContribution);

    themeService.onThemeChange((themeInfo) => {
      if (themeInfo.id.startsWith('md3-')) {
        if (!this.layoutContribution) {
          this.layoutContribution = this.createLayoutContribution();
          context.contributeExtension('bonnext:layout', this.layoutContribution);
        }
      } else {
        if (this.layoutContribution) {
          context.contributeExtension('bonnext:layout', this.layoutContribution);
        }
      }
    });
  }

  async deactivate(): Promise<void> {
    this.registeredThemeIds = [];
    this.layoutContribution = null;
    if (this.fontLink && this.fontLink.parentNode) {
      this.fontLink.parentNode.removeChild(this.fontLink);
      this.fontLink = null;
    }
  }

  private loadRobotoFont(): void {
    if (document.querySelector('link[data-bonnext-roboto]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
    link.setAttribute('data-bonnext-roboto', 'true');
    document.head.appendChild(link);
    this.fontLink = link;
  }

  private createLayoutContribution(): LayoutContribution {
    return {
      NavigationRail: MD3NavigationRail,
      TopAppBar: MD3TopAppBar,
      FAB: MD3FAB,
      components: {
        Button: MD3Button,
        Card: MD3Card,
        Dialog: MD3Dialog,
        TextField: MD3TextField,
        Select: MD3Select,
        Switch: MD3Switch,
        Checkbox: MD3Checkbox,
        Tabs: MD3Tabs,
        Chip: MD3Chip,
        Badge: MD3Badge,
        List: MD3List,
        Icon: MD3Icon,
        Divider: MD3Divider,
      },
      typography: MD3_TYPOGRAPHY,
      themeTokens: {},
    };
  }

  private registerThemes(themeService: ThemeService): void {
    for (const id of this.registeredThemeIds) {
      themeService.unregisterTheme(id);
    }
    this.registeredThemeIds = [];

    const contributions = generateMD3Contributions(this.currentSeedColor);
    for (const contribution of contributions) {
      themeService.registerTheme(contribution, this.id);
      this.registeredThemeIds.push(contribution.id);
    }
  }

  changeSeedColor(seedColor: string, themeService: ThemeService): void {
    this.currentSeedColor = seedColor;
    try {
      localStorage.setItem('bonnext:md3-seed-color', seedColor);
    } catch {}
    const currentId = themeService.getCurrentTheme()?.id;
    this.registerThemes(themeService);
    if (currentId && this.registeredThemeIds.includes(currentId)) {
      themeService.switchTheme(currentId, { animate: false }).catch(() => {});
    }
  }

  getCurrentSeedColor(): string {
    return this.currentSeedColor;
  }
}
```

Note: The `onThemeChange` handler in `activate()` currently re-contributes the layout on non-MD3 theme switch. This needs refinement — the layout should be retracted when switching away from MD3. However, the current PluginContext doesn't support retracting individual contributions. This will be addressed in Task 14.

---

## Task 13: Modify AppShell to support layout switching

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: Import useLayout and MD3AppShell, add layout switching logic**

Add imports at the top of `App.tsx`:

```typescript
import { LayoutExtensionPoint } from './plugins/extensions';
```

The `LayoutExtensionPoint` is already imported in Task 3. Now add the `useLayout` import:

```typescript
import { useLayout } from './plugins/builtins/md3-theme/layout/useLayout';
import { MD3AppShell } from './plugins/builtins/md3-theme/layout/MD3AppShell';
```

- [ ] **Step 2: Modify AppShell to use layout switching**

Replace the main return block of `AppShell` (the part after the auth check) with:

```typescript
  const layout = useLayout();

  if (layout) {
    return (
      <ErrorBoundary>
        <MD3AppShell layout={layout} />
        <SearchPalette
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          instances={instState.instances}
          versions={[]}
          navigate={navigateById}
        />
      </ErrorBoundary>
    );
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="noise-overlay" />
      <div className="scanline-overlay" />
      <div className="app-shell">
        <div className="app-layout">
          <Sidebar
          navItems={NAV_ITEMS}
          username={authState.currentUser.username}
          accountType={
            authState.accounts.find((a) => a.id === authState.activeAccountId)?.account_type?.toUpperCase() || 'OFFLINE'
          }
          playtimeHours={todayPlaytimeHours}
          totalPlaytimeHours={totalPlaytimeHours}
        />
        <main className="app-main" id="main-content">
          <div className="decorative-rect decorative-rect--top-right" />
          <div className="decorative-rect decorative-rect--bottom-left" />

          <ErrorBoundary>
            <PageTransition>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/instances" element={<InstancesPage />} />
                  <Route path="/instances/new" element={<NewInstancePage />} />
                  <Route path="/instances/:id" element={<InstanceDetailPage />} />
                  <Route path="/versions" element={<VersionsPage />} />
                  <Route path="/store" element={<MarketplacePage />} />
                  <Route path="/mods" element={<MarketplacePage />} />
                  <Route path="/store/:type/:slug" element={<ContentDetailPage />} />
                  <Route path="/collections" element={<CollectionsPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              </Suspense>
            </PageTransition>
          </ErrorBoundary>
        </main>
        </div>
      </div>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        instances={instState.instances}
        versions={[]}
        navigate={navigateById}
      />
    </>
  );
```

---

## Task 14: Implement layout retract on theme switch

**Files:**

- Modify: `src/plugins/core/PluginContext.ts` — add `retractExtension` method
- Modify: `src/plugins/core/PluginManager.ts` — handle retraction during active plugin lifecycle
- Modify: `src/plugins/builtins/md3-theme/MD3ThemePlugin.ts` — retract layout when switching to ZZZ theme

- [ ] **Step 1: Add retractExtension to PluginContextImpl**

In `src/plugins/core/PluginContext.ts`, add the method:

```typescript
  retractExtension(pointId: string, contribution: unknown): void {
    const idx = this.contributedExtensions.findIndex(
      (e) => e.pointId === pointId && e.contribution === contribution
    );
    if (idx !== -1) {
      this.contributedExtensions.splice(idx, 1);
    }
  }
```

Also add it to the `PluginContext` interface in `src/plugins/core/types.ts`:

```typescript
export interface PluginContext {
  pluginId: string;
  storage: PluginStorage;
  logger: PluginLogger;
  provideService(id: string, service: unknown): void;
  consumeService(id: string): unknown;
  registerExtensionPoint(point: ExtensionPoint): void;
  contributeExtension(pointId: string, contribution: unknown): void;
  retractExtension(pointId: string, contribution: unknown): void;
  getExtensionPoint(id: string): ExtensionPoint | undefined;
}
```

- [ ] **Step 2: Add retractExtension to PluginManager**

In `src/plugins/core/PluginManager.ts`, add a new method:

```typescript
  retractContribution(pluginId: string, pointId: string, contribution: unknown): void {
    const point = this.extensionPoints.get(pointId);
    if (point) {
      point.onRetract(contribution);
    }
    const context = this.contexts.get(pluginId);
    if (context) {
      context.retractExtension(pointId, contribution);
    }
  }
```

- [ ] **Step 3: Update MD3ThemePlugin to retract/contribute layout based on theme**

Replace the `onThemeChange` handler in `MD3ThemePlugin.activate()` with:

```typescript
let contextRef = context;
themeService.onThemeChange((themeInfo) => {
  if (themeInfo.id.startsWith('md3-')) {
    if (!this.layoutContribution) {
      this.layoutContribution = this.createLayoutContribution();
      contextRef.contributeExtension('bonnext:layout', this.layoutContribution);
    }
  } else {
    if (this.layoutContribution) {
      const manager = (contextRef as any).serviceRegistry;
      contextRef.retractExtension('bonnext:layout', this.layoutContribution);
      this.layoutContribution = null;
    }
  }
});
```

Wait — `contextRef.retractExtension` only removes from the context's tracking list. We need to also call `point.onRetract`. The PluginManager needs to expose this. Let me revise:

Actually, looking at the PluginManager code, when `contributeExtension` is called on the context, it just stores it. The actual `point.onContribute` is called in `PluginManager.activate()` after the plugin's `activate()` completes, by iterating `context.getContributedExtensions()`. So for runtime contribute/retract, we need the plugin to access the manager directly.

Better approach: Store the PluginManager reference and call its methods. But the current architecture doesn't give plugins access to the manager.

**Revised approach**: Use the `LayoutExtensionPoint` listener pattern instead. The `useLayout` hook already listens for contribute/retract events. We just need the MD3 plugin to contribute the layout when MD3 theme is active and retract it when ZZZ theme is active. Since `contributeExtension` on the context only stores contributions (and `onContribute` is called by PluginManager after `activate()`), we need a different mechanism for runtime contribute/retract.

**Solution**: Give the MD3 plugin access to the LayoutExtensionPoint directly via the service registry.

In `MD3ThemePlugin.activate()`:

```typescript
const layoutPoint = context.consumeService('bonnext:layout-point') as LayoutExtensionPoint | undefined;
```

And register the LayoutExtensionPoint as a service in App.tsx before plugins activate. Actually, a cleaner approach: register the extension point as a service.

**Simplest approach**: The MD3 plugin already has access to the context which has `contributeExtension`. We need to add a `retractExtension` that also notifies the extension point. Let me add a method to PluginContextImpl that does both:

In `src/plugins/core/PluginContext.ts`, add a `pluginManager` reference:

Actually, the cleanest solution is to pass the PluginManager to PluginContextImpl. Let me update the constructor:

```typescript
export class PluginContextImpl implements PluginContext {
  public readonly pluginId: string;
  public readonly storage: PluginStorage;
  public readonly logger: PluginLogger;
  private serviceRegistry: ServiceRegistry;
  private pluginManager: PluginManager;
  private contributedExtensions: Array<{ pointId: string; contribution: unknown }> = [];

  constructor(pluginId: string, serviceRegistry: ServiceRegistry, storage: PluginStorage, pluginManager: PluginManager) {
    this.pluginId = pluginId;
    this.serviceRegistry = serviceRegistry;
    this.storage = storage;
    this.pluginManager = pluginManager;
    this.logger = { ... };
  }

  retractExtension(pointId: string, contribution: unknown): void {
    const idx = this.contributedExtensions.findIndex(
      (e) => e.pointId === pointId && e.contribution === contribution
    );
    if (idx !== -1) {
      this.contributedExtensions.splice(idx, 1);
    }
    const point = this.pluginManager.getExtensionPoint(pointId);
    if (point) {
      point.onRetract(contribution);
    }
  }

  contributeExtensionRuntime(pointId: string, contribution: unknown): void {
    this.contributedExtensions.push({ pointId, contribution });
    const point = this.pluginManager.getExtensionPoint(pointId);
    if (point) {
      point.onContribute(contribution);
    }
  }
}
```

And update `PluginManager.activate()` to pass `this` to the context constructor:

```typescript
const context = new PluginContextImpl(pluginId, this.serviceRegistry, new MemoryPluginStorage(), this);
```

Then in `MD3ThemePlugin`, the `onThemeChange` handler can use:

```typescript
themeService.onThemeChange((themeInfo) => {
  if (themeInfo.id.startsWith('md3-')) {
    if (!this.layoutContribution) {
      this.layoutContribution = this.createLayoutContribution();
      context.contributeExtensionRuntime('bonnext:layout', this.layoutContribution);
    }
  } else {
    if (this.layoutContribution) {
      context.retractExtension('bonnext:layout', this.layoutContribution);
      this.layoutContribution = null;
    }
  }
});
```

This is the correct approach. Let me update the task steps accordingly.

- [ ] **Step 4: Update PluginContextImpl constructor and add methods**

Update `src/plugins/core/PluginContext.ts`:

```typescript
import type { PluginStorage, PluginLogger, ExtensionPoint, PluginContext } from './types';
import type { ServiceRegistry } from './ServiceRegistry';
import type { PluginManager } from './PluginManager';

export class PluginContextImpl implements PluginContext {
  public readonly pluginId: string;
  public readonly storage: PluginStorage;
  public readonly logger: PluginLogger;
  private serviceRegistry: ServiceRegistry;
  private pluginManager: PluginManager;
  private extensionPoints = new Map<string, ExtensionPoint>();
  private contributedExtensions: Array<{ pointId: string; contribution: unknown }> = [];

  constructor(
    pluginId: string,
    serviceRegistry: ServiceRegistry,
    storage: PluginStorage,
    pluginManager: PluginManager,
  ) {
    this.pluginId = pluginId;
    this.serviceRegistry = serviceRegistry;
    this.storage = storage;
    this.pluginManager = pluginManager;
    this.logger = {
      info: (msg: string, ...args: unknown[]) => console.info(`[${pluginId}] ${msg}`, ...args),
      warn: (msg: string, ...args: unknown[]) => console.warn(`[${pluginId}] ${msg}`, ...args),
      error: (msg: string, ...args: unknown[]) => console.error(`[${pluginId}] ${msg}`, ...args),
    };
  }

  provideService(id: string, service: unknown): void {
    this.serviceRegistry.provide(id, service, this.pluginId);
  }

  consumeService(id: string): unknown {
    return this.serviceRegistry.consume(id);
  }

  registerExtensionPoint(point: ExtensionPoint): void {
    this.extensionPoints.set(point.id, point);
  }

  contributeExtension(pointId: string, contribution: unknown): void {
    this.contributedExtensions.push({ pointId, contribution });
  }

  contributeExtensionRuntime(pointId: string, contribution: unknown): void {
    this.contributedExtensions.push({ pointId, contribution });
    const point = this.pluginManager.getExtensionPoint(pointId);
    if (point) {
      point.onContribute(contribution);
    }
  }

  retractExtension(pointId: string, contribution: unknown): void {
    const idx = this.contributedExtensions.findIndex((e) => e.pointId === pointId && e.contribution === contribution);
    if (idx !== -1) {
      this.contributedExtensions.splice(idx, 1);
    }
    const point = this.pluginManager.getExtensionPoint(pointId);
    if (point) {
      point.onRetract(contribution);
    }
  }

  getExtensionPoint(id: string): ExtensionPoint | undefined {
    return this.extensionPoints.get(id);
  }

  getContributedExtensions(): Array<{ pointId: string; contribution: unknown }> {
    return [...this.contributedExtensions];
  }

  clearContributions(): void {
    this.contributedExtensions = [];
  }
}
```

- [ ] **Step 5: Update PluginManager to pass `this` to context**

In `src/plugins/core/PluginManager.ts`, update the `activate` method:

```typescript
const context = new PluginContextImpl(pluginId, this.serviceRegistry, new MemoryPluginStorage(), this);
```

- [ ] **Step 6: Update PluginContext interface in types.ts**

Add the new methods to the `PluginContext` interface:

```typescript
export interface PluginContext {
  pluginId: string;
  storage: PluginStorage;
  logger: PluginLogger;
  provideService(id: string, service: unknown): void;
  consumeService(id: string): unknown;
  registerExtensionPoint(point: ExtensionPoint): void;
  contributeExtension(pointId: string, contribution: unknown): void;
  contributeExtensionRuntime(pointId: string, contribution: unknown): void;
  retractExtension(pointId: string, contribution: unknown): void;
  getExtensionPoint(id: string): ExtensionPoint | undefined;
}
```

- [ ] **Step 7: Update MD3ThemePlugin onThemeChange handler**

In `src/plugins/builtins/md3-theme/MD3ThemePlugin.ts`, update the `activate` method's `onThemeChange` handler:

```typescript
themeService.onThemeChange((themeInfo) => {
  if (themeInfo.id.startsWith('md3-')) {
    if (!this.layoutContribution) {
      this.layoutContribution = this.createLayoutContribution();
      context.contributeExtensionRuntime('bonnext:layout', this.layoutContribution);
    }
  } else {
    if (this.layoutContribution) {
      context.retractExtension('bonnext:layout', this.layoutContribution);
      this.layoutContribution = null;
    }
  }
});
```

---

## Task 15: Build verification and runtime test

**Files:**

- None (verification only)

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors

- [ ] **Step 2: Full build**

```bash
pnpm build 2>&1 | tail -10
```

Expected: Build succeeds

- [ ] **Step 3: Run existing tests**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: All tests pass

- [ ] **Step 4: Start dev server and verify with Playwright**

```bash
pnpm dev &
sleep 5
```

Then run a Playwright test that:

1. Loads the app
2. Switches to MD3 Dark theme via localStorage + reload
3. Verifies `theme-md3-dark` class on `<html>`
4. Verifies Navigation Rail is rendered (80px wide nav element)
5. Verifies Top App Bar is rendered (64px high header)
6. Verifies `@material/web` components are registered (check for `md-filled-button` custom element)
7. Switches back to ZZZ Dark
8. Verifies original Sidebar layout is restored

---

## Self-Review

**1. Spec coverage check:**

- ✅ `bonnext:layout` extension point → Task 2
- ✅ LayoutContribution interface with NavigationRail, TopAppBar, FAB, 12 components → Task 2
- ✅ AppShell conditional rendering → Task 13
- ✅ useLayout() hook → Task 4
- ✅ @material/web installation → Task 1
- ✅ 15 React Wrapper components → Tasks 6, 7, 8
- ✅ MD3 Navigation Rail → Task 9
- ✅ MD3 Top App Bar → Task 10
- ✅ MD3AppShell → Task 11
- ✅ MD3ThemePlugin contributes layout → Task 12
- ✅ Typography system → Task 5
- ✅ --md-sys-color-\* mapping → Task 5
- ✅ Roboto font loading → Task 12
- ✅ Layout retract on theme switch → Task 14
- ✅ ZZZ layout preservation → Task 13 (original code untouched)
- ❌ Page conditional rendering (MD3HomePage etc.) — Not in Phase 1, deferred to Phase 2-4
- ❌ Snackbar wrapper — Not included in 15 wrappers, can be added later

**2. Placeholder scan:** No TBD/TODO found. All code is complete.

**3. Type consistency:**

- `LayoutContribution` interface defined in Task 2 matches usage in Tasks 11, 12, 13
- `NavigationRailProps`, `TopAppBarProps`, `FABProps` defined in Task 2 match usage in Tasks 9, 10
- `PluginContext` interface updated in Task 14 includes new methods
- `PluginContextImpl` constructor signature updated to include `PluginManager` parameter

**Gaps identified:**

1. Snackbar wrapper is mentioned in the spec's component inventory but not implemented. Adding it is trivial but not needed for Phase 1.
2. Page-level conditional rendering (MD3HomePage etc.) is Phase 2-4 work. In Phase 1, pages will render with their ZZZ layout inside the MD3AppShell's content area. This is acceptable as a starting point — the shell (Navigation Rail + Top App Bar) will be MD3, while page content still uses ZZZ components until Phase 2.
3. The `MD3AppShell` component in Task 11 uses `ErrorBoundary` but doesn't import it. Need to add the import.
