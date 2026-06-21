/**
 * PageBreadcrumb - 统一页面面包屑导航
 *
 * 在 AppShell 中统一渲染，所有二级页面自动获得面包屑。
 * 当面包屑只有一条（如首页）时不显示。
 * 解决用户进入二级界面后"不知道自己在哪里"的迷失感。
 */
import { Breadcrumb } from '../ui/Breadcrumb';
import { useBreadcrumb } from '../../../../shared/hooks/useBreadcrumb';

export function PageBreadcrumb() {
  const items = useBreadcrumb();
  // 只有一条面包屑时（如首页），不显示
  if (items.length <= 1) return null;
  return <Breadcrumb items={items} />;
}
