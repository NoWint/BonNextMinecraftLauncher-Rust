import React from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * 页面过渡组件:监听路由变化,通过 key 触发重挂载实现入场动画。
 * 包裹的子元素会在路由切换时重新挂载并应用 .page-enter 动画。
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter" style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
