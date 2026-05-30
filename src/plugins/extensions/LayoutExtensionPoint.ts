import type { ComponentType } from 'react';
import { ExtensionPointBase } from './ExtensionPoint';
import type { IconName } from '../../components/ui/Icon';

export interface NavigationRailProps {
  items: Array<{
    id: string;
    label: string;
    icon: IconName;
  }>;
  activeId: string;
  onNavigate: (id: string) => void;
  fabIcon?: IconName;
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
  icon?: IconName;
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

export class LayoutExtensionPoint extends ExtensionPointBase<LayoutContribution> {
  readonly id = 'bonnext:layout';
  readonly name = 'Layout Extension Point';

  getActiveLayout(): LayoutContribution | undefined {
    return this.getContributions()[0];
  }
}
