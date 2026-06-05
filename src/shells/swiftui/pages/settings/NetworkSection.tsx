import { ListGroup, ListItem, Toggle } from '../../components/ui';

export function NetworkSection() {
  return (
    <ListGroup label="Network">
      <ListItem label="Proxy" value={<Toggle checked={false} onChange={() => {}} />} />
    </ListGroup>
  );
}
