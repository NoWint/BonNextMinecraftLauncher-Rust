import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
  column?: number;
  speed?: number;
  trail?: number;
}

type ParticleMode = 'default' | 'dataflow';

export function ParticleBackground({ active = false, mode = 'default' }: { active?: boolean; mode?: ParticleMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const isVisibleRef = useRef(true);
  const speedMultiplier = useRef(1);
  const modeRef = useRef<ParticleMode>(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 12000));
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: 1 + Math.random() * 2.5,
      opacity: 0.1 + Math.random() * 0.3,
      hue: 45 + Math.random() * 10,
    }));

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouse);

    const onVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      if (isVisibleRef.current) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const dataFlowColumns = 20;
    const dataFlowParticles: Particle[] = [];
    const colWidth = canvas.width / dataFlowColumns;

    const initDataFlow = () => {
      dataFlowParticles.length = 0;
      for (let col = 0; col < dataFlowColumns; col++) {
        const numInCol = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numInCol; i++) {
          dataFlowParticles.push({
            x: col * colWidth + colWidth * 0.2 + Math.random() * colWidth * 0.6,
            y: Math.random() * canvas.height,
            vx: 0,
            vy: 0.3 + Math.random() * 0.8,
            size: 1 + Math.random() * 1.5,
            opacity: 0.15 + Math.random() * 0.25,
            hue: 45 + Math.random() * 10,
            column: col,
            speed: 0.3 + Math.random() * 0.8,
            trail: 3 + Math.random() * 8,
          });
        }
      }
    };
    initDataFlow();

    const animate = () => {
      if (!isVisibleRef.current) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { x: mx, y: my } = mouseRef.current;
      const spd = speedMultiplier.current;
      const isDataFlow = modeRef.current === 'dataflow';

      if (isDataFlow) {
        for (const p of dataFlowParticles) {
          p.vy = (p.speed || 0.5) * spd;
          p.y += p.vy;

          if (p.y > canvas.height + 20) {
            p.y = -10;
            p.x = (p.column || 0) * colWidth + colWidth * 0.2 + Math.random() * colWidth * 0.6;
            p.opacity = 0.15 + Math.random() * 0.25;
          }

          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 120) {
            const force = ((120 - dist) / 120) * 0.3;
            p.x += (dx / dist) * force;
          }

          const trailLen = p.trail || 5;
          const gradient = ctx.createLinearGradient(p.x, p.y - trailLen * p.vy, p.x, p.y);
          gradient.addColorStop(0, `hsla(${p.hue}, 100%, 70%, 0)`);
          gradient.addColorStop(1, `hsla(${p.hue}, 100%, 70%, ${p.opacity * 0.6})`);

          ctx.beginPath();
          ctx.moveTo(p.x, p.y - trailLen * p.vy);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = p.size * 0.8;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 100%, 80%, ${p.opacity * 0.8})`;
          ctx.fill();

          if (p.size > 1.5) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.opacity * 0.06})`;
            ctx.fill();
          }
        }

        ctx.strokeStyle = `hsla(45, 100%, 70%, 0.015)`;
        ctx.lineWidth = 0.5;
        for (let col = 0; col < dataFlowColumns; col++) {
          const x = col * colWidth + colWidth * 0.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
      } else {
        for (const p of particlesRef.current) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 150) {
            const force = ((150 - dist) / 150) * 0.5 * spd;
            p.vx += (dx / dist) * force * 0.1;
            p.vy += (dy / dist) * force * 0.1;
          }

          p.vx *= 0.995;
          p.vy *= 0.995;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed > 1.5 * spd) {
            p.vx = (p.vx / speed) * 1.5 * spd;
            p.vy = (p.vy / speed) * 1.5 * spd;
          }

          p.x += p.vx;
          p.y += p.vy;

          if (p.x < -10) p.x = canvas.width + 10;
          if (p.x > canvas.width + 10) p.x = -10;
          if (p.y < -10) p.y = canvas.height + 10;
          if (p.y > canvas.height + 10) p.y = -10;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.opacity * 0.7})`;
          ctx.fill();

          if (p.size > 2) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.opacity * 0.1})`;
            ctx.fill();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    speedMultiplier.current = active ? 3 : 1;
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.6,
      }}
    />
  );
}
