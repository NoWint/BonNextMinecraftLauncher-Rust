import { useCallback } from 'react';

/**
 * Fires confetti particles from the center of the screen.
 * Each particle is a small colored square with random trajectory.
 */
export function useConfetti() {
  return useCallback(() => {
    const colors = ['#FFE600', '#FF4444', '#00FF88', '#4488FF', '#FF8800', '#FF44FF'];
    const container = document.body;

    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${40 + Math.random() * 20}%`;
      piece.style.top = `${-5 - Math.random() * 10}%`;
      piece.style.width = `${4 + Math.random() * 6}px`;
      piece.style.height = `${4 + Math.random() * 6}px`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = `${1.5 + Math.random() * 2}s`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.clipPath = Math.random() > 0.5
        ? 'polygon(0 0, calc(100% - 2px) 0, 100% 2px, 100% 100%, 0 100%)'
        : 'none';

      container.appendChild(piece);
      setTimeout(() => piece.remove(), 3000);
    }
  }, []);
}
