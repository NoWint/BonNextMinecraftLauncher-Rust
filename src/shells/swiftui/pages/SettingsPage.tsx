import { AppearanceSection, GameSection, DownloadSection, NetworkSection, SecuritySection, AccountSection, AboutSection } from './settings';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Settings</h1>
      <p className="swiftui-page-subtitle">Configure BonNext</p>
      <div className={styles.container}>
        <AppearanceSection />
        <GameSection />
        <DownloadSection />
        <NetworkSection />
        <SecuritySection />
        <AccountSection />
        <AboutSection />
      </div>
    </div>
  );
}
