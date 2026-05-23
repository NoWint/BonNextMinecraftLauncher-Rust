import { TextInput, Select } from '../ui';
import {
  type ContentType, type DataSource,
  GAME_VERSIONS, LOADER_OPTIONS, SORT_OPTIONS, TAGS_BY_TYPE,
} from './types';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  contentType: ContentType;
  source: DataSource;
  searchQuery: string;
  selectedTags: string[];
  gameVersion: string;
  loader: string;
  sortBy: string;
  onSourceChange: (source: DataSource) => void;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onTagToggle: (tag: string) => void;
  onClearTags: () => void;
  onVersionChange: (version: string) => void;
  onLoaderChange: (loader: string) => void;
  onSortChange: (sort: string) => void;
}

export default function FilterBar({
  contentType, source, searchQuery, selectedTags,
  gameVersion, loader, sortBy,
  onSourceChange, onSearchChange, onSearchSubmit,
  onTagToggle, onClearTags,
  onVersionChange, onLoaderChange, onSortChange,
}: FilterBarProps) {
  const tags = TAGS_BY_TYPE[contentType] || [];
  const hasActiveFilters = !!(searchQuery || selectedTags.length > 0 || gameVersion || loader);

  return (
    <div className={styles.wrapper}>
      <div className={styles.searchRow}>
        <div className={styles.searchInput}>
          <TextInput
            placeholder={`Search ${contentType}s, modpacks, shaders...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
          />
        </div>
        <div className={styles.sourceToggle}>
          <button
            className={`${styles.sourceBtn} ${source === 'modrinth' ? styles['sourceBtn--active'] : ''}`}
            onClick={() => onSourceChange('modrinth')}
          >
            MODRINTH
          </button>
          <button
            className={`${styles.sourceBtn} ${source === 'curseforge' ? styles['sourceBtn--active'] : ''}`}
            onClick={() => onSourceChange('curseforge')}
          >
            CURSEFORGE
          </button>
        </div>
      </div>

      <div className={styles.tagRow}>
        {tags.map((tag) => (
          <button
            key={tag}
            className={`${styles.tag} ${selectedTags.includes(tag) ? styles['tag--active'] : ''}`}
            onClick={() => onTagToggle(tag)}
          >
            {tag}
          </button>
        ))}
        {hasActiveFilters && (
          <button className={styles.tag} onClick={onClearTags}>
            ✕ Clear filters
          </button>
        )}
      </div>

      <div className={styles.filterRow}>
        <div className={styles.filterSelect}>
          <Select
            value={gameVersion}
            onChange={(e) => onVersionChange(e.target.value)}
            options={[
              { value: '', label: 'All versions' },
              ...GAME_VERSIONS.filter(Boolean).map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
        <div className={styles.filterSelect}>
          <Select
            value={loader}
            onChange={(e) => onLoaderChange(e.target.value)}
            options={LOADER_OPTIONS}
          />
        </div>
        <div className={styles.filterSelect}>
          <Select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            options={SORT_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}
