import { useState, useEffect } from 'react';
import { formatError } from '../../utils/errorMapping';
import { api } from '../../api';
import { useToast } from '../../shared/stores/toastStore';
import { Tooltip } from './Tooltip';

interface CollectionButtonProps {
  slug: string;
  title: string;
  author: string;
  iconUrl: string;
  contentType: string;
  description: string;
  downloads: number;
  categories: string[];
  size?: 'sm' | 'md';
}

export function CollectionButton({
  slug,
  title,
  author,
  iconUrl,
  contentType,
  description,
  downloads,
  categories,
  size = 'sm',
}: CollectionButtonProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    api
      .isInCollection(slug)
      .then((v) => {
        if (!cancelled) setSaved(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setLoading(true);
    try {
      if (saved) {
        await api.removeFromCollection(slug);
        setSaved(false);
        addToast({ type: 'info', title: 'Removed', message: `${title} removed from collection` });
      } else {
        await api.addToCollection(slug, title, author, iconUrl, contentType, description, downloads, categories);
        setSaved(true);
        addToast({ type: 'success', title: 'Saved', message: `${title} added to collection` });
      }
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Failed', message: formatError(e) });
    } finally {
      setLoading(false);
    }
  };

  const fontSize = size === 'md' ? '1.2em' : '0.85em';
  const padding = size === 'md' ? '6px 10px' : '4px 8px';

  return (
    <Tooltip content={saved ? 'Remove from collection' : 'Add to collection'}>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        aria-label={saved ? 'Remove from collection' : 'Add to collection'}
        style={{
          background: saved ? 'rgba(255, 68, 68, 0.12)' : 'var(--color-panel)',
          border: saved ? '1px solid rgba(255, 68, 68, 0.3)' : '1px solid var(--color-border)',
          color: saved ? '#FF4444' : 'var(--color-text-dim)',
          fontSize,
          padding,
          cursor: 'pointer',
          clipPath: 'var(--clip-small)',
          transition: 'all var(--transition-fast)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {loading ? '...' : saved ? '\u{2665}' : '\u{2661}'}
      </button>
    </Tooltip>
  );
}
