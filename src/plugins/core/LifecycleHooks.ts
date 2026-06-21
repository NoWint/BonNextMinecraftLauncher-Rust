// src/plugins/core/LifecycleHooks.ts

/**
 * 插件生命周期钩子定义。
 *
 * 插件通过 PluginDefinition.hooks 声明钩子处理器。
 * PluginManager.emitLifecycleHook() 在核心事件发生时遍历 active 插件调用对应钩子。
 *
 * before* 钩子是 async + 可拦截的：
 * - 任一插件返回 { allow: false, reason } 即中止操作
 * - 全部返回 { allow: true } 或 undefined 才继续
 * - 钩子抛异常视为 allow: false（fail-closed）
 *
 * after* 钩子是 fire-and-forget：
 * - 不拦截操作，错误仅记录日志
 * - 适合做通知、统计、清理等副作用
 */

/** 实例启动前钩子参数 */
export interface BeforeInstanceLaunchArgs {
  instanceId: string;
  instanceName: string;
  versionId: string;
}

/** 实例启动后钩子参数 */
export interface AfterInstanceLaunchArgs {
  instanceId: string;
  instanceName: string;
  versionId: string;
  success: boolean;
  error?: string;
}

/** 模组安装前钩子参数 */
export interface BeforeModInstallArgs {
  instanceId: string;
  modSlug: string;
  modName: string;
  versionId: string;
}

/** 模组安装后钩子参数 */
export interface AfterModInstallArgs {
  instanceId: string;
  modSlug: string;
  modName: string;
  versionId: string;
  success: boolean;
  error?: string;
}

/** 应用就绪钩子参数 */
export interface OnAppReadyArgs {
  appVersion: string;
}

/** before* 钩子的返回值 */
export interface HookResult {
  /** 是否允许操作继续。false 表示拦截。 */
  allow: boolean;
  /** 拦截原因（allow: false 时填写） */
  reason?: string;
}

/** 插件生命周期钩子接口 */
export interface PluginLifecycleHooks {
  /** 应用就绪时调用（所有插件激活后） */
  onAppReady?(args: OnAppReadyArgs): void | Promise<void>;

  /** 实例启动前（可拦截） */
  beforeInstanceLaunch?(args: BeforeInstanceLaunchArgs): Promise<HookResult> | HookResult | void;

  /** 实例启动后（fire-and-forget） */
  afterInstanceLaunch?(args: AfterInstanceLaunchArgs): void | Promise<void>;

  /** 模组安装前（可拦截） */
  beforeModInstall?(args: BeforeModInstallArgs): Promise<HookResult> | HookResult | void;

  /** 模组安装后（fire-and-forget） */
  afterModInstall?(args: AfterModInstallArgs): void | Promise<void>;
}

/** 钩子名称类型 */
export type LifecycleHookName = keyof PluginLifecycleHooks;

/** before* 钩子名称 */
export const INTERCEPTABLE_HOOKS: ReadonlySet<LifecycleHookName> = new Set([
  'beforeInstanceLaunch',
  'beforeModInstall',
]);

/** after* 钩子名称 */
export const FIRE_AND_FORGET_HOOKS: ReadonlySet<LifecycleHookName> = new Set([
  'onAppReady',
  'afterInstanceLaunch',
  'afterModInstall',
]);
