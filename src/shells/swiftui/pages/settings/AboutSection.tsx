import { useState, useEffect } from 'react';
import { ListGroup, ListItem } from '../../components/ui';
import { getVersion } from '@tauri-apps/api/app';

export function AboutSection() {
  const [version, setVersion] = useState('...');

  useEffect(() => {
    getVersion().then((v) => setVersion(v)).catch(() => setVersion('unknown'));
  }, []);

  return (
    <ListGroup label="About">
      <ListItem label="Version" value={version} />
      <ListItem label="License" value="MIT" />
    </ListGroup>
  );
}
