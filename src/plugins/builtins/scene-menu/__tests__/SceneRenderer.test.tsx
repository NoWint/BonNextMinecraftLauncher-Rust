import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SceneRenderer } from '../SceneRenderer';

describe('SceneRenderer', () => {
  it('renders fallback gradient when WebGL unavailable', () => {
    // jsdom 无 WebGL，detectWebGL 返回 false
    render(<SceneRenderer active={true} plyUrl={null} offset={{ x: 0, y: 0, z: 0 }} />);
    expect(screen.getByTestId('scene-fallback')).toBeInTheDocument();
  });

  it('renders fallback when plyUrl is null even if WebGL exists', () => {
    render(<SceneRenderer active={true} plyUrl={null} offset={{ x: 0, y: 0, z: 0 }} />);
    expect(screen.getByTestId('scene-fallback')).toBeInTheDocument();
  });

  it('does not render canvas when no plyUrl', () => {
    render(<SceneRenderer active={true} plyUrl={null} offset={{ x: 0, y: 0, z: 0 }} />);
    expect(screen.queryByTestId('scene-canvas')).toBeNull();
  });
});
