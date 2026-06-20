import { useEffect, useRef, useState } from 'react';
import { SkinViewer, IdleAnimation } from 'skinview3d';
import { logger } from '../../../../shared/utils/logger';
import { Icon } from './Icon';
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
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (viewerRef.current) {
      viewerRef.current.dispose();
      viewerRef.current = null;
    }

    try {
      const viewer = new SkinViewer({
        canvas,
        width,
        height,
        enableControls: true,
      });
      viewer.renderer.setClearColor(0x000000, 0);
      viewer.animation = new IdleAnimation();
      viewer.autoRotate = true;
      viewer.autoRotateSpeed = 0.5;
      viewerRef.current = viewer;
      setError(false);
    } catch (e) {
      logger.warn('Failed to create SkinViewer:', e);
      setError(true);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, [width, height]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (skinUrl) {
      try {
        viewer.loadSkin(skinUrl, { model }).catch((e: unknown) => {
          logger.warn('Failed to load skin:', e);
        });
      } catch (e) {
        logger.warn('Failed to load skin:', e);
      }
    } else {
      viewer.resetSkin();
    }
  }, [skinUrl, model]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (capeUrl) {
      try {
        viewer.loadCape(capeUrl).catch((e: unknown) => {
          logger.warn('Failed to load cape:', e);
        });
      } catch (e) {
        logger.warn('Failed to load cape:', e);
      }
    } else {
      viewer.resetCape();
    }
  }, [capeUrl]);

  if (error) {
    return (
      <div className={`${styles.wrapper} ${className}`} style={{ width, height }}>
        <div className={styles.fallback}>
          <span className={styles.fallback__icon}>
            <Icon name="diamondOutline" size={16} />
          </span>
          <span className={styles.fallback__text}>3D</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.wrapper} ${className}`}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
