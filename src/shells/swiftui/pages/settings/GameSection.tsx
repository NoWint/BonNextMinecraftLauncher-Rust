import { ListGroup, ListItem } from '../../components/ui';

export function GameSection() {
  return (
    <ListGroup label="Game">
      <ListItem label="Java Path" value="Auto-detect" />
      <ListItem label="Max Memory" value="2 GB" />
      <ListItem label="Min Memory" value="512 MB" />
    </ListGroup>
  );
}
