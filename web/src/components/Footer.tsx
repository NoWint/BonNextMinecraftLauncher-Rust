import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brand}>
            Bon<span className={styles.brandAccent}>Next</span>
          </div>
          <div className={styles.links}>
            <div className={styles.col}>
              <div className={styles.colTitle}>产品</div>
              <a href="#download">下载</a>
              <a href="#design">设计</a>
            </div>
            <div className={styles.col}>
              <div className={styles.colTitle}>开发</div>
              <a href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a>
              <a href="#architecture">架构</a>
            </div>
            <div className={styles.col}>
              <div className={styles.colTitle}>社区</div>
              <a href="https://github.com/issues" target="_blank" rel="noreferrer">Issues</a>
              <a href="#">Discord</a>
            </div>
          </div>
        </div>
        <div className={styles.legal}>
          © 2026 BonNext. Built with Rust + React + Tauri.
        </div>
      </div>
    </footer>
  );
}
