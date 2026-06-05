import { GlobeIcon } from '../components/icons';
import styles from './ServersPage.module.css';

export default function ServersPage() {
  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Servers</h1>
      <p className="swiftui-page-subtitle">Multiplayer server browser</p>
      <div className={styles.empty}>
        <GlobeIcon size={32} />
        <p style={{ marginTop: 'var(--swift-spacing-md)' }}>Server browser coming soon</p>
      </div>
    </div>
  );
}
