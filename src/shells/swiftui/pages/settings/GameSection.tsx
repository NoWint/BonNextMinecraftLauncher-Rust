import { useState } from 'react';
import { ListGroup, ListItem } from '../../components/ui';
import { useConfig } from '../../../../shared/stores/configStore';

export function GameSection() {
  const { state, updateConfigOptimistic } = useConfig();
  const config = state.config;
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!config) return null;

  const startEdit = (field: string, current: string) => {
    setEditing(field);
    setEditValue(current);
  };

  const commitEdit = async (field: string) => {
    setEditing(null);
    if (field === 'java_path') {
      await updateConfigOptimistic({ java_path: editValue || null });
    } else if (field === 'max_memory') {
      const val = parseInt(editValue, 10);
      if (!isNaN(val) && val > 0) await updateConfigOptimistic({ max_memory: val });
    } else if (field === 'min_memory') {
      const val = parseInt(editValue, 10);
      if (!isNaN(val) && val > 0) await updateConfigOptimistic({ min_memory: val });
    }
  };

  const javaDisplay = config.java_path || 'Auto-detect';
  const maxMemDisplay = `${Math.round(config.max_memory / 1024 * 100) / 100} GB`;
  const minMemDisplay = config.min_memory >= 1024 ? `${Math.round(config.min_memory / 1024 * 100) / 100} GB` : `${config.min_memory} MB`;

  return (
    <ListGroup label="Game">
      {editing === 'java_path' ? (
        <ListItem
          label="Java Path"
          value={
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitEdit('java_path')}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('java_path'); if (e.key === 'Escape') setEditing(null); }}
              autoFocus
              style={{ background: 'var(--swift-bg-secondary)', border: '1px solid var(--swift-accent)', borderRadius: 6, padding: '2px 6px', color: 'inherit', fontSize: 'inherit', width: 200 }}
            />
          }
        />
      ) : (
        <ListItem label="Java Path" value={javaDisplay} onClick={() => startEdit('java_path', config.java_path || '')} />
      )}
      {editing === 'max_memory' ? (
        <ListItem
          label="Max Memory"
          value={
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitEdit('max_memory')}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('max_memory'); if (e.key === 'Escape') setEditing(null); }}
              autoFocus
              style={{ background: 'var(--swift-bg-secondary)', border: '1px solid var(--swift-accent)', borderRadius: 6, padding: '2px 6px', color: 'inherit', fontSize: 'inherit', width: 80 }}
            />
          }
        />
      ) : (
        <ListItem label="Max Memory" value={maxMemDisplay} onClick={() => startEdit('max_memory', String(config.max_memory))} />
      )}
      {editing === 'min_memory' ? (
        <ListItem
          label="Min Memory"
          value={
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitEdit('min_memory')}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('min_memory'); if (e.key === 'Escape') setEditing(null); }}
              autoFocus
              style={{ background: 'var(--swift-bg-secondary)', border: '1px solid var(--swift-accent)', borderRadius: 6, padding: '2px 6px', color: 'inherit', fontSize: 'inherit', width: 80 }}
            />
          }
        />
      ) : (
        <ListItem label="Min Memory" value={minMemDisplay} onClick={() => startEdit('min_memory', String(config.min_memory))} />
      )}
    </ListGroup>
  );
}
