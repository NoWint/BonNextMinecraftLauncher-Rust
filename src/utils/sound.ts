type SoundTheme = 'cyberpunk' | 'minimal' | 'silent';

type ThemeConfig = {
  click: (number | string)[];
  success: (number | string)[];
  error: (number | string)[];
  download: (number | string)[];
  launch: (number | string)[];
};

const THEME_CONFIGS: Record<SoundTheme, ThemeConfig> = {
  cyberpunk: {
    click: [1200, 0.03, 0, 'square', 0.02],
    success: [523, 659, 784, 0.08, 0, 'sine', 0.05],
    error: [200, 150, 0.12, 0, 'sawtooth', 0.04],
    download: [440, 554, 659, 0.06, 0, 'triangle', 0.04],
    launch: [330, 440, 554, 659, 0.15, 0, 'sine', 0.05],
  },
  minimal: {
    click: [600, 0.02, 0, 'sine', 0.01],
    success: [800, 0.05, 0, 'sine', 0.03],
    error: [300, 0.08, 0, 'sine', 0.02],
    download: [700, 0.04, 0, 'sine', 0.02],
    launch: [500, 0.1, 0, 'sine', 0.03],
  },
  silent: {
    click: [0, 0, 0, 'sine', 0],
    success: [0, 0, 0, 'sine', 0],
    error: [0, 0, 0, 'sine', 0],
    download: [0, 0, 0, 'sine', 0],
    launch: [0, 0, 0, 'sine', 0],
  },
};

const audioCtx =
  typeof window !== 'undefined'
    ? new (
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )()
    : null;

function getVolume(): number {
  const stored = localStorage.getItem('bonnext_sound_volume');
  return stored ? parseInt(stored, 10) / 100 : 0.5;
}

function getTheme(): SoundTheme {
  return (localStorage.getItem('bonnext_sound_theme') as SoundTheme) || 'cyberpunk';
}

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
  } catch {
    // Audio context may not be available
  }
}

function playThemedSound(soundType: keyof ThemeConfig) {
  if (!audioCtx) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const theme = getTheme();
  const config = THEME_CONFIGS[theme][soundType];
  const masterVolume = getVolume();

  if (masterVolume === 0) return;

  if (theme === 'silent') return;

  const toOsc = (v: number | string) => v as OscillatorType;
  const toNum = (v: number | string) => v as number;

  if (soundType === 'click') {
    const [freq, duration, , type, vol] = config;
    playTone(toNum(freq), toNum(duration), toOsc(type), toNum(vol) * masterVolume);
  } else if (soundType === 'success') {
    if (theme === 'minimal') {
      const [freq, duration, , type, vol] = config;
      playTone(toNum(freq), toNum(duration), toOsc(type), toNum(vol) * masterVolume);
    } else {
      const [f1, f2, f3, duration, , type, vol] = config;
      const d = toNum(duration);
      const t = toOsc(type);
      const v = toNum(vol) * masterVolume;
      playTone(toNum(f1), d, t, v);
      setTimeout(() => playTone(toNum(f2), d, t, v), d * 1000);
      setTimeout(() => playTone(toNum(f3), d * 1.5, t, v), d * 2000);
    }
  } else if (soundType === 'error') {
    if (theme === 'minimal') {
      const [freq, duration, , type, vol] = config;
      playTone(toNum(freq), toNum(duration), toOsc(type), toNum(vol) * masterVolume);
    } else {
      const [f1, f2, duration, , type, vol] = config;
      const d = toNum(duration);
      const t = toOsc(type);
      const v = toNum(vol) * masterVolume;
      playTone(toNum(f1), d, t, v);
      setTimeout(() => playTone(toNum(f2), d * 1.3, t, v), d * 1000);
    }
  } else if (soundType === 'download') {
    if (theme === 'minimal') {
      const [freq, duration, , type, vol] = config;
      playTone(toNum(freq), toNum(duration), toOsc(type), toNum(vol) * masterVolume);
    } else {
      const [f1, f2, f3, duration, , type, vol] = config;
      const d = toNum(duration);
      const t = toOsc(type);
      const v = toNum(vol) * masterVolume;
      playTone(toNum(f1), d, t, v);
      setTimeout(() => playTone(toNum(f2), d, t, v), d * 1000);
      setTimeout(() => playTone(toNum(f3), d * 1.5, t, v), d * 2000);
    }
  } else if (soundType === 'launch') {
    if (theme === 'minimal') {
      const [freq, duration, , type, vol] = config;
      playTone(toNum(freq), toNum(duration), toOsc(type), toNum(vol) * masterVolume);
    } else {
      const [f1, f2, f3, f4, duration, , type, vol] = config;
      const d = toNum(duration);
      const t = toOsc(type);
      const v = toNum(vol) * masterVolume;
      playTone(toNum(f1), d, t, v);
      setTimeout(() => playTone(toNum(f2), d, t, v), d * 1000);
      setTimeout(() => playTone(toNum(f3), d, t, v), d * 2000);
      setTimeout(() => playTone(toNum(f4), d * 1.5, t, v), d * 3000);
    }
  }
}

export const sound = {
  click: () => playThemedSound('click'),
  success: () => playThemedSound('success'),
  error: () => playThemedSound('error'),
  downloadDone: () => playThemedSound('download'),
  launch: () => playThemedSound('launch'),
  toggle: () => playThemedSound('click'),
  tab: () => playThemedSound('click'),
  notification: () => playThemedSound('success'),
  hover: () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    const vol = getVolume();
    if (vol === 0) return;
    playTone(1500, 0.02, 'sine', 0.01 * vol);
  },
};

if (typeof window !== 'undefined') {
  const unlock = () => {
    audioCtx?.resume().catch(() => {});
    window.removeEventListener('click', unlock);
  };
  window.addEventListener('click', unlock);
}
