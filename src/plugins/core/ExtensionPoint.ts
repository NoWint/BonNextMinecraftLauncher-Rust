// src/plugins/core/ExtensionPoint.ts

/**
 * 扩展点定义。
 *
 * 核心代码通过 declareExtensionPoint() 声明一个扩展点，
 * 插件通过 ctx.contribute(epId, value) 贡献内容，
 * 核心代码通过 useExtensions(epId) hook 获取所有贡献。
 *
 * @template T 贡献值的类型
 */
export interface ExtensionPoint<T = unknown> {
  /** 扩展点唯一 ID，如 'home:widget' */
  readonly id: string;
  /** 可选的运行时类型守卫，校验贡献值是否符合预期结构 */
  readonly validate?: (value: unknown) => value is T;
  /** 可选的描述，用于文档和调试 */
  readonly description?: string;
}

/** 带插件来源信息的贡献项 */
export interface Contribution<T = unknown> {
  /** 贡献的扩展点 ID */
  epId: string;
  /** 贡献的插件 ID */
  pluginId: string;
  /** 贡献值 */
  value: T;
  /** 贡献顺序（用于排序，小的在前） */
  order?: number;
}

/**
 * 扩展点注册表。
 * 维护所有扩展点的贡献列表，支持订阅变更。
 */
export class ExtensionPointRegistry {
  /** epId → 贡献列表 */
  private contributions = new Map<string, Contribution[]>();
  /** 已声明的扩展点定义 epId → ExtensionPoint */
  private declared = new Map<string, ExtensionPoint>();
  /** 订阅监听器 */
  private listeners = new Set<() => void>();
  /** 缓存的快照（epId → Contribution[]），供 useSyncExternalStore 使用 */
  private snapshots = new Map<string, Contribution[]>();

  /** 声明一个扩展点 */
  declare<T>(ep: ExtensionPoint<T>): void {
    if (this.declared.has(ep.id)) {
      console.warn(`[ExtensionPointRegistry] Extension point "${ep.id}" already declared, overwriting`);
    }
    this.declared.set(ep.id, ep as ExtensionPoint<unknown>);
  }

  /** 检查扩展点是否已声明 */
  isDeclared(epId: string): boolean {
    return this.declared.has(epId);
  }

  /** 获取扩展点定义 */
  getDeclaration(epId: string): ExtensionPoint | undefined {
    return this.declared.get(epId);
  }

  /**
   * 插件贡献到扩展点。
   * 如果扩展点有 validate 函数且校验失败，抛出错误。
   * 如果扩展点未声明，告警但仍接受贡献（宽松模式，便于测试）。
   */
  contribute(epId: string, pluginId: string, value: unknown, order?: number): void {
    const ep = this.declared.get(epId);
    if (ep) {
      if (ep.validate && !ep.validate(value)) {
        throw new Error(
          `Contribution to "${epId}" from plugin "${pluginId}" failed validation`,
        );
      }
    } else {
      console.warn(
        `[ExtensionPointRegistry] Contributing to undeclared extension point "${epId}"`,
      );
    }

    const list = this.contributions.get(epId) ?? [];
    list.push({ epId, pluginId, value, order });
    this.contributions.set(epId, list);
    this.invalidateSnapshot(epId);
    this.notify();
  }

  /** 获取某扩展点的所有贡献（按 order 升序排列） */
  getContributions<T = unknown>(epId: string): Contribution<T>[] {
    const snapshot = this.snapshots.get(epId);
    if (snapshot) return snapshot as Contribution<T>[];
    const list = this.contributions.get(epId) ?? [];
    const sorted = [...list].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    this.snapshots.set(epId, sorted);
    return sorted as Contribution<T>[];
  }

  /** 移除某插件的所有贡献（deactivate 时调用） */
  removeByPlugin(pluginId: string): void {
    let changed = false;
    for (const [epId, list] of this.contributions) {
      const filtered = list.filter((c) => c.pluginId !== pluginId);
      if (filtered.length !== list.length) {
        this.contributions.set(epId, filtered);
        this.invalidateSnapshot(epId);
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  /** 订阅变更，返回取消订阅函数 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 清空所有贡献和声明（测试用） */
  clear(): void {
    this.contributions.clear();
    this.declared.clear();
    this.snapshots.clear();
    this.notify();
  }

  private invalidateSnapshot(epId: string): void {
    this.snapshots.delete(epId);
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('[ExtensionPointRegistry] Listener error:', e);
      }
    });
  }
}

// ===== 核心扩展点声明 =====

/** 首页 widget 贡献 */
export interface HomeWidgetContribution {
  /** widget 唯一 ID */
  id: string;
  /** 显示标题 */
  title: string;
  /** 懒加载 React 组件 */
  component: () => Promise<{ default: React.ComponentType<unknown> }>;
  /** 默认列宽（1-4） */
  colSpan?: number;
}

/** 实例详情页标签页贡献 */
export interface InstanceTabContribution {
  id: string;
  label: string;
  component: () => Promise<{ default: React.ComponentType<unknown> }>;
}

/** 侧边栏快捷操作贡献 */
export interface SidebarActionContribution {
  id: string;
  label: string;
  icon: string;
  action: () => void;
}

/** 首页 widget 扩展点 */
export const HOME_WIDGET_EP: ExtensionPoint<HomeWidgetContribution> = {
  id: 'home:widget',
  description: 'Contribute widgets to the home page dashboard',
  validate: (v): v is HomeWidgetContribution => {
    if (typeof v !== 'object' || v === null) return false;
    const obj = v as Record<string, unknown>;
    return typeof obj.id === 'string' &&
      typeof obj.title === 'string' &&
      typeof obj.component === 'function';
  },
};

/** 实例标签页扩展点 */
export const INSTANCE_TAB_EP: ExtensionPoint<InstanceTabContribution> = {
  id: 'instance:tab',
  description: 'Contribute tabs to the instance detail page',
  validate: (v): v is InstanceTabContribution => {
    if (typeof v !== 'object' || v === null) return false;
    const obj = v as Record<string, unknown>;
    return typeof obj.id === 'string' &&
      typeof obj.label === 'string' &&
      typeof obj.component === 'function';
  },
};

/** 侧边栏操作扩展点 */
export const SIDEBAR_ACTION_EP: ExtensionPoint<SidebarActionContribution> = {
  id: 'sidebar:action',
  description: 'Contribute quick actions to the sidebar',
  validate: (v): v is SidebarActionContribution => {
    if (typeof v !== 'object' || v === null) return false;
    const obj = v as Record<string, unknown>;
    return typeof obj.id === 'string' &&
      typeof obj.label === 'string' &&
      typeof obj.icon === 'string' &&
      typeof obj.action === 'function';
  },
};

/** 所有核心扩展点列表（供初始化时批量声明） */
export const CORE_EXTENSION_POINTS: ExtensionPoint[] = [
  HOME_WIDGET_EP,
  INSTANCE_TAB_EP,
  SIDEBAR_ACTION_EP,
];
