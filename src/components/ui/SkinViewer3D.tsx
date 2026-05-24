import { useEffect, useRef, useCallback } from 'react';
import { SkinViewer, IdleAnimation } from 'skinview3d';
import styles from './SkinViewer3D.module.css';

interface SkinViewer3DProps {
  skinUrl: string | null;
  capeUrl?: string | null;
  model?: 'default' | 'slim' | 'auto-detect';
  width?: number;
  height?: number;
  className?: string;
}

export default function SkinViewer3D({
  skinUrl,
  capeUrl,
  model = 'auto-detect',
  width = 200,
  height = 300,
  className = '',
}: SkinViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (viewerRef.current) {
      viewerRef.current.dispose();
    }

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
      background: 0x00000000,
      enableControls: true,
    });

    viewer.animation = new IdleAnimation();
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.5;

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (skinUrl) {
      viewer.loadSkin(skinUrl, { model });
    } else {
      viewer.resetSkin();
    }
  }, [skinUrl, model]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (capeUrl) {
      viewer.loadCape(capeUrl);
    } else {
      viewer.resetCape();
    }
  }, [capeUrl]);

  const handleCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
  }, []);

  return (
    <div className={`${styles.wrapper} ${className}`}>
      <canvas ref={handleCanvasRef} className={styles.canvas} />
    </div>
  );
}
