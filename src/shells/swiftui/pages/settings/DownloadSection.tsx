import { ListGroup, ListItem } from '../../components/ui';

export function DownloadSection() {
  return (
    <ListGroup label="Downloads">
      <ListItem label="Concurrent Downloads" value="8" />
      <ListItem label="Mirror" value="Official" />
    </ListGroup>
  );
}
