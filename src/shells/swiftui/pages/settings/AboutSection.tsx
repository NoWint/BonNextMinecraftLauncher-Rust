import { ListGroup, ListItem } from '../../components/ui';

export function AboutSection() {
  return (
    <ListGroup label="About">
      <ListItem label="Version" value="1.0.0" />
      <ListItem label="License" value="MIT" />
    </ListGroup>
  );
}
