import { useEffect, useRef, useState, useCallback } from 'react';
import { useI18n } from '../../../../shared/i18n';
import styles from './SettingsNav.module.css';

export interface NavCategory {
  id: string;
  label: string;
  sectionIds: string[];
}

interface SettingsNavProps {
  categories: NavCategory[];
  scrollContainerSelector?: string;
}

function isScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const overflowY = style.overflowY;
  return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
}

function getScrollParent(el: HTMLElement): HTMLElement {
  let parent = el.parentElement;
  while (parent) {
    if (isScrollable(parent)) return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
}


function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;

  const scrollParent = getScrollParent(el);
  const start = scrollParent.scrollTop;
  const target = el.getBoundingClientRect().top + scrollParent.scrollTop - scrollParent.getBoundingClientRect().top - 20;
  const distance = target - start;
  const duration = 500;

  let startTime: number | null = null;

  function step(timestamp: number) {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutExpo(progress);

    scrollParent.scrollTop = start + distance * easedProgress;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

export default function SettingsNav({ categories, scrollContainerSelector }: SettingsNavProps) {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<string>(categories[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleSections = useRef<Set<string>>(new Set());

  const handleClick = useCallback((category: NavCategory) => {
    const firstSection = category.sectionIds[0];
    if (firstSection) {
      scrollToSection(firstSection);
    }
    setActiveId(category.id);
  }, []);

  useEffect(() => {
    const allSectionIds = categories.flatMap((c) => c.sectionIds);
    if (allSectionIds.length === 0) return;

    const scrollContainer = scrollContainerSelector
      ? document.querySelector(scrollContainerSelector)
      : null;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.current.add(entry.target.id);
          } else {
            visibleSections.current.delete(entry.target.id);
          }
        }

        for (const category of categories) {
          for (const sectionId of category.sectionIds) {
            if (visibleSections.current.has(sectionId)) {
              setActiveId(category.id);
              return;
            }
          }
        }
      },
      {
        root: scrollContainer,
        rootMargin: '-40px 0px -60% 0px',
        threshold: 0,
      },
    );

    const currentObserver = observerRef.current;

    for (const id of allSectionIds) {
      const el = document.getElementById(id);
      if (el) {
        currentObserver.observe(el);
      }
    }

    return () => {
      currentObserver.disconnect();
      visibleSections.current.clear();
    };
  }, [categories, scrollContainerSelector]);

  return (
    <nav className={styles.nav} aria-label={t('settingsNav.ariaLabel')}>
      {categories.map((category) => (
        <button
          key={category.id}
          className={`${styles.navItem} ${activeId === category.id ? styles['navItem--active'] : ''}`}
          onClick={() => handleClick(category)}
          title={category.label}
        >
          <span className={styles.navItem__indicator} />
          <span className={styles.navItem__label}>{category.label}</span>
        </button>
      ))}
    </nav>
  );
}
