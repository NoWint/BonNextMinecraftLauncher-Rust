import { ListGroup, ListItem, Toggle } from '../../components/ui';

export function SecuritySection() {
  return (
    <ListGroup label="Security">
      <ListItem label="Sandbox Mode" value={<Toggle checked={false} onChange={() => {}} />} />
    </ListGroup>
  );
}
