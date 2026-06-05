import { useState } from 'react';
import styles from './JVMPresets.module.css';

export interface JVMPreset {
  id: string;
  name: string;
  description: string;
  args: string[];
  minMemory: number;
  recommendedMemory: number;
}

export const JVM_PRESETS: JVMPreset[] = [
  {
    id: 'performance',
    name: '性能优先',
    description: 'G1GC + 并行引用处理，适合追求流畅帧率的场景',
    args: [
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:G1NewSizePercent=20',
      '-XX:G1ReservePercent=20',
      '-XX:G1HeapRegionSize=8M',
      '-XX:G1HeapWastePercent=5',
      '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15',
      '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5',
      '-XX:SurvivorRatio=32',
      '-XX:+PerfDisableSharedMem',
      '-XX:MaxTenuringThreshold=1',
    ],
    minMemory: 2048,
    recommendedMemory: 4096,
  },
  {
    id: 'compatibility',
    name: '兼容优先',
    description: 'SerialGC + 保守设置，适合老旧系统或兼容性问题排查',
    args: [
      '-XX:+UseSerialGC',
      '-XX:+UseCompressedOops',
      '-XX:-OmitStackTraceInFastThrow',
      '-XX:MaxDirectMemorySize=256M',
    ],
    minMemory: 1024,
    recommendedMemory: 2048,
  },
  {
    id: 'large-modpack',
    name: '大模组包',
    description: 'G1GC + 大内存 + 大代码缓存，适合 200+ 模组的整合包',
    args: [
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:G1NewSizePercent=20',
      '-XX:G1ReservePercent=20',
      '-XX:G1HeapRegionSize=16M',
      '-XX:G1HeapWastePercent=5',
      '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15',
      '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5',
      '-XX:SurvivorRatio=32',
      '-XX:+PerfDisableSharedMem',
      '-XX:MaxTenuringThreshold=1',
      '-XX:ReservedCodeCacheSize=512M',
      '-XX:InitialCodeCacheSize=256M',
      '-XX:+UseCodeCacheFlushing',
      '-XX:MaxMetaspaceSize=512M',
      '-XX:CompressedClassSpaceSize=256M',
    ],
    minMemory: 4096,
    recommendedMemory: 8192,
  },
  {
    id: 'lightweight',
    name: '轻量级',
    description: '最小参数集，适合原版或少量模组的轻量实例',
    args: ['-XX:+UseG1GC', '-XX:MaxGCPauseMillis=50'],
    minMemory: 512,
    recommendedMemory: 1024,
  },
];

interface JVMPresetsProps {
  activePresetId: string | null;
  onSelectPreset: (preset: JVMPreset) => void;
}

export default function JVMPresets({ activePresetId, onSelectPreset }: JVMPresetsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {JVM_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`${styles.card} ${activePresetId === preset.id ? styles.cardActive : ''}`}
            onClick={() => {
              onSelectPreset(preset);
              setExpandedId(expandedId === preset.id ? null : preset.id);
            }}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardName}>{preset.name}</span>
              {activePresetId === preset.id && <span className={styles.activeDot} />}
            </div>
            <span className={styles.cardDesc}>{preset.description}</span>
            <div className={styles.cardMeta}>
              <span className={styles.metaItem}>
                <span className={styles.metaLabel}>MIN</span>
                <span className={styles.metaValue}>
                  {preset.minMemory >= 1024 ? `${preset.minMemory / 1024}G` : `${preset.minMemory}M`}
                </span>
              </span>
              <span className={styles.metaDivider} />
              <span className={styles.metaItem}>
                <span className={styles.metaLabel}>REC</span>
                <span className={styles.metaValue}>
                  {preset.recommendedMemory >= 1024
                    ? `${preset.recommendedMemory / 1024}G`
                    : `${preset.recommendedMemory}M`}
                </span>
              </span>
              <span className={styles.metaDivider} />
              <span className={styles.metaItem}>
                <span className={styles.metaLabel}>ARGS</span>
                <span className={styles.metaValue}>{preset.args.length}</span>
              </span>
            </div>
            {expandedId === preset.id && (
              <div className={styles.expanded}>
                <div className={styles.argsList}>
                  {preset.args.map((arg, i) => (
                    <span key={i} className={styles.argPill}>
                      {arg}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
