import { HeartIcon } from '../icons';
import styles from './CollectionButton.module.css';

interface CollectionButtonProps { collected: boolean; onClick: () => void; }

export function CollectionButton({ collected, onClick }: CollectionButtonProps) {
  return (
    <button className={`${styles.button} ${collected ? styles.active : ''}`} onClick={onClick} aria-label={collected ? 'Remove from collection' : 'Add to collection'}>
      <HeartIcon filled={collected} size={18} />
    </button>
  );
}
