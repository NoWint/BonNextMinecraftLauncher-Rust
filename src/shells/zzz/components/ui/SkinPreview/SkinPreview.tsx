import { useRef, useEffect } from 'react';
import styles from './SkinPreview.module.css';

interface Props {
  skinUrl: string | null;
  size?: number;
}

export default function SkinPreview({ skinUrl, size = 48 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!skinUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
    };
    img.src = skinUrl;
  }, [skinUrl, size]);

  return <canvas ref={canvasRef} width={size} height={size} className={styles.canvas} />;
}
