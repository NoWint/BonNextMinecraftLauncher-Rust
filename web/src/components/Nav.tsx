import { useEffect, useState } from 'react';
import styles from './Nav.module.css';

const LINKS = [
  { href: '#hero', label: 'BonNext' },
  { href: '#design', label: '设计' },
  { href: '#performance', label: '性能' },
  { href: '#architecture', label: '架构' },
  { href: '#download', label: '下载' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`} aria-label="主导航">
      <a href="#hero" className={styles.logo}>
        Bon<span className={styles.logoAccent}>Next</span>
      </a>
      <ul className={styles.links}>
        {LINKS.slice(1).map((link) => (
          <li key={link.href}>
            <a href={link.href} className={styles.link}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <a href="#download" className={styles.cta}>
        下载
      </a>
    </nav>
  );
}
