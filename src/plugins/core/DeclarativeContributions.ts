// src/plugins/core/DeclarativeContributions.ts
import type { PluginManifest, PluginContext, ThemeContribution, PluginLabel } from './types';
import { componentRegistry } from './ComponentRegistry';

/**
 * 将 manifest.contributes 中的相对 i18nKey 转换为绝对键 `plugin:<pluginId>:<relativeKey>`。
 * 纯字符串 label 原样返回。
 */
function absolutizeLabel(label: PluginLabel, pluginId: string): PluginLabel {
  if (typeof label === 'string') return label;
  // 已经是绝对键（以 plugin: 开头）则不再加前缀
  if (label.i18nKey.startsWith('plugin:')) return label;
  return { i18nKey: `plugin:${pluginId}:${label.i18nKey}` };
}

/**
 * 遍历 manifest.contributes，把声明式贡献通过 ctx 注册到 PluginManager。
 * 在 definition.activate(ctx) 之前调用，使 UI 注入与插件代码解耦。
 *
 * 组件字符串通过 ComponentRegistry 解析为懒加载函数。
 * 解析失败的贡献项跳过并告警，不阻断插件激活。
 *
 * sidebar label 如果是 { i18nKey }，会转换为绝对键 `plugin:<id>:<key>`，
 * 配合 PluginManager 在激活时注册的 manifest.i18n 资源使用。
 */
export function applyDeclarativeContributions(
  manifest: PluginManifest | undefined,
  ctx: PluginContext,
): void {
  if (!manifest?.contributes) return;

  const { contributes } = manifest;
  const pluginId = manifest.id;

  // 路由
  for (const route of contributes.routes ?? []) {
    const loader = componentRegistry.resolve(route.component);
    if (!loader) {
      console.warn(
        `[DeclarativeContributions] Component "${route.component}" not registered for route ${route.path}`,
      );
      continue;
    }
    ctx.registerRoute(route.path, loader);
  }

  // 侧边栏
  for (const item of contributes.sidebar ?? []) {
    ctx.addSidebarItem({
      id: item.id,
      label: absolutizeLabel(item.label, pluginId),
      icon: item.icon,
      route: item.route,
      order: item.order,
    });
  }

  // 设置页
  for (const section of contributes.settings ?? []) {
    const loader = componentRegistry.resolve(section.component);
    if (!loader) {
      console.warn(
        `[DeclarativeContributions] Component "${section.component}" not registered for settings ${section.id}`,
      );
      continue;
    }
    ctx.addSettingsSection({
      id: section.id,
      label: section.label,
      component: loader,
      order: section.order,
    });
  }

  // 上下文菜单 — action 无法声明式表达，由插件在 activate() 里注册
  for (const item of contributes.contextMenu ?? []) {
    console.debug(
      `[DeclarativeContributions] Context menu item "${item.id}" declared, plugin should register action in activate()`,
    );
  }

  // 实例标签页
  for (const tab of contributes.instanceTabs ?? []) {
    const loader = componentRegistry.resolve(tab.component);
    if (!loader) {
      console.warn(
        `[DeclarativeContributions] Component "${tab.component}" not registered for instance tab ${tab.id}`,
      );
      continue;
    }
    ctx.addInstanceTab({
      id: tab.id,
      label: tab.label,
      component: loader,
      order: tab.order,
    });
  }

  // 主题
  for (const theme of contributes.themes ?? []) {
    const contribution: Omit<ThemeContribution, 'pluginId'> = {
      id: theme.id,
      name: theme.name,
      cssVariables: theme.cssVariables ?? {},
      fonts: theme.fonts,
      mode: theme.mode ?? 'dark',
    };
    ctx.registerTheme(contribution);
  }
}
