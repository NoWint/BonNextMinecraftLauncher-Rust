import { useRef, useEffect } from 'react';
import type { MD3DialogProps } from '@/plugins/extensions';

type MdDialogEl = HTMLElement & { show: () => void; open: boolean };

export function MD3Dialog({ open, onClose, headline, children, actions }: MD3DialogProps) {
  const ref = useRef<MdDialogEl>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      el.show();
    } else {
      el.open = false;
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClose) return;
    const handler = () => onClose();
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onClose]);

  return (
    <md-dialog ref={ref as React.Ref<MdDialogEl>}>
      {headline && <div slot="headline">{headline}</div>}
      <div slot="content">{children}</div>
      {actions && <div slot="actions">{actions}</div>}
    </md-dialog>
  );
}
