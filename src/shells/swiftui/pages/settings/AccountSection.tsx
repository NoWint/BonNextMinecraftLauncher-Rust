import { useAuth } from '../../../../shared/stores/authStore';
import { ListGroup, ListItem } from '../../components/ui';

export function AccountSection() {
  const { state } = useAuth();
  return (
    <ListGroup label="Account">
      <ListItem label="Username" value={state.currentUser?.username || 'Not logged in'} />
      <ListItem label="Account Type" value={state.currentUser?.access_token?.startsWith('offline_') ? 'Offline' : 'Microsoft'} />
    </ListGroup>
  );
}
