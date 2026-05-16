// Lightweight sound effects using Web Audio API
const audioCtx = typeof window !== 'undefined'
  ? new (window.AudioContext || (window as any).webkitAudioContext)()
  : null;

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.08) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

export const sound = {
  click: () => playTone(800, 0.05, 'square', 0.03),
  success: () => { playTone(523, 0.1, 'sine', 0.06); setTimeout(() => playTone(659, 0.1, 'sine', 0.06), 100); setTimeout(() => playTone(784, 0.15, 'sine', 0.06), 200); },
  error: () => { playTone(200, 0.15, 'sawtooth', 0.05); setTimeout(() => playTone(150, 0.2, 'sawtooth', 0.05), 150); },
  downloadDone: () => { playTone(440, 0.08, 'sine', 0.05); setTimeout(() => playTone(554, 0.08, 'sine', 0.05), 80); setTimeout(() => playTone(660, 0.12, 'sine', 0.05), 160); },
  launch: () => { playTone(330, 0.3, 'sine', 0.06); setTimeout(() => playTone(440, 0.3, 'sine', 0.06), 150); setTimeout(() => playTone(550, 0.4, 'sine', 0.06), 300); },
};

// Auto-unlock audio context on first user interaction
if (typeof window !== 'undefined') {
  const unlock = () => {
    audioCtx?.resume().catch(() => {});
    window.removeEventListener('click', unlock);
  };
  window.addEventListener('click', unlock);
}
