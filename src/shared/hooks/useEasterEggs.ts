import { useEffect, useRef } from 'react';

// Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA',
];

const BON_NEXT_SEQUENCE = [
  'KeyB', 'KeyO', 'KeyN',
];

export function useEasterEggs(
  onKonami?: () => void,
  onBonNext?: () => void,
) {
  const konamiIdx = useRef(0);
  const bonNextIdx = useRef(0);
  const konamiTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Konami code
      if (e.code === KONAMI_SEQUENCE[konamiIdx.current]) {
        konamiIdx.current++;
        if (konamiIdx.current === KONAMI_SEQUENCE.length) {
          konamiIdx.current = 0;
          onKonami?.();
        }
      } else {
        konamiIdx.current = 0;
      }

      // B-O-N sequence
      if (e.code === BON_NEXT_SEQUENCE[bonNextIdx.current]) {
        bonNextIdx.current++;
        if (bonNextIdx.current === BON_NEXT_SEQUENCE.length) {
          bonNextIdx.current = 0;
          onBonNext?.();
        }
      } else {
        bonNextIdx.current = 0;
      }

      // Reset konami after 2s of inactivity
      clearTimeout(konamiTimer.current);
      konamiTimer.current = setTimeout(() => { konamiIdx.current = 0; }, 2000);
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(konamiTimer.current);
    };
  }, [onKonami, onBonNext]);
}

const MC_TRIVIA = [
  'Did you know? The Creeper was created by accident when Notch tried to make a pig.',
  'Fun fact: Minecraft has sold over 300 million copies worldwide.',
  'Trivia: The End Poem was written by Julian Gough in a single weekend.',
  'Did you know? Endermen were inspired by the Slender Man mythos.',
  'Pro tip: You can sleep in the Nether... just kidding, you absolutely cannot.',
  'Fun fact: The first version of Minecraft was made in just 6 days.',
  'Trivia: Villagers have their own language called "Villager Speak".',
  'Did you know? The Wither is the only boss mob that players can build themselves.',
  'Pro tip: Diamond ore is most common at Y=-58 in modern versions.',
  'Fun fact: There are over 2.8 trillion possible horse color combinations.',
  'Trivia: Ghast sounds were made by C418\'s cat.',
  'Did you know? The Far Lands were an infamous terrain generation bug pre-1.8.',
  'Pro tip: You can charge Respawn Anchors with glowstone in the Nether.',
  'Fun fact: Jeb\'s name is an acronym — Jens Bergensten.',
  'Trivia: Pig steps sound effects were made using real pigs.',
];

export function getRandomTrivia(): string {
  return MC_TRIVIA[Math.floor(Math.random() * MC_TRIVIA.length)];
}
