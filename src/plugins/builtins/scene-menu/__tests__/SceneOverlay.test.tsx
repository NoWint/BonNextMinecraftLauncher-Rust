import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SceneOverlay } from '../SceneOverlay';

function makeCtx(overrides: any = {}) {
  return {
    invoke: overrides.invoke ?? vi.fn().mockResolvedValue({ id: 'u1' }),
    events: { on: overrides.events?.on ?? vi.fn() },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as any;
}

describe('SceneOverlay', () => {
  beforeEach(() => {
    window.location.hash = '#/home';
    vi.clearAllMocks();
  });

  it('renders overlay when authenticated and on home', async () => {
    render(<SceneOverlay ctx={makeCtx()} />);
    await waitFor(() => expect(screen.getByTestId('scene-overlay')).toBeInTheDocument());
  });

  it('does not render overlay when not on home', async () => {
    window.location.hash = '#/instances';
    const ctx = makeCtx();
    render(<SceneOverlay ctx={ctx} />);
    // 未认证或非 home → 不渲染 overlay 内容（容器存在但 hidden）
    await waitFor(() => {
      const el = screen.queryByTestId('scene-overlay');
      expect(el).toBeNull();
    });
  });

  it('clicking 实例 navigates to #/instances after transition', async () => {
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    render(<SceneOverlay ctx={ctx} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /实例/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /实例/ }));
    // 转场时序：push 1500ms → hold 800ms → fade 500ms → navigate 2800ms
    await waitFor(() => expect(window.location.hash).toBe('#/instances'), { timeout: 4000 });
  });
});
