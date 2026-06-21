import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuLayer } from '../MenuLayer';

describe('MenuLayer', () => {
  it('renders 4 menu panels with correct labels', () => {
    const onAction = vi.fn();
    render(<MenuLayer onAction={onAction} launchingName={null} launchState="idle" launchError={null} />);
    expect(screen.getByRole('button', { name: /启动游戏/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /实例/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /商店/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /设置/ })).toBeInTheDocument();
  });

  it('clicking 实例 triggers onAction("instances")', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<MenuLayer onAction={onAction} launchingName={null} launchState="idle" launchError={null} />);
    await user.click(screen.getByRole('button', { name: /实例/ }));
    expect(onAction).toHaveBeenCalledWith('instances');
  });

  it('clicking 启动 triggers onAction("launch")', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<MenuLayer onAction={onAction} launchingName={null} launchState="idle" launchError={null} />);
    await user.click(screen.getByRole('button', { name: /启动游戏/ }));
    expect(onAction).toHaveBeenCalledWith('launch');
  });

  it('shows launching name when launchState is launching', () => {
    render(<MenuLayer onAction={vi.fn()} launchingName="1.20.4-Fabric" launchState="launching" launchError={null} />);
    expect(screen.getByText(/1\.20\.4-Fabric/)).toBeInTheDocument();
  });

  it('Tab cycles through 4 panels', async () => {
    const user = userEvent.setup();
    render(<MenuLayer onAction={vi.fn()} launchingName={null} launchState="idle" launchError={null} />);
    const launch = screen.getByRole('button', { name: /启动游戏/ });
    launch.focus();
    expect(launch).toHaveFocus();
    await user.tab();
    // Tab 移动到下一个面板（顺序由 DOM 顺序决定）
    expect(screen.getByRole('button', { name: /实例/ })).toHaveFocus();
  });
});
