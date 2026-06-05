import { useInstances } from '../../../shared/stores/instanceStore';
import { InstanceSelect } from '../components/features';
import { useState } from 'react';
import styles from './LibraryPage.module.css';

export default function LibraryPage() {
  const { state } = useInstances();
  const [selectedId, setSelectedId] = useState(state.instances[0]?.id);
  const selected = state.instances.find((i) => i.id === selectedId);

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Library</h1>
      <p className="swiftui-page-subtitle">Installed content per instance</p>
      <div style={{ marginBottom: 'var(--swift-spacing-lg)' }}>
        <InstanceSelect instances={state.instances} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      {selected ? (
        <div className={styles.grid}>
          <p style={{ color: 'var(--swift-text-tertiary)', gridColumn: '1 / -1' }}>No installed content found for this instance.</p>
        </div>
      ) : (
        <div className={styles.empty}>Select an instance to view its library</div>
      )}
    </div>
  );
}
