interface ToggleProps { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; id?: string; }

export function Toggle({ checked, onChange, disabled = false, id }: ToggleProps) {
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 24, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} id={id} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
      <span style={{ position: 'absolute', inset: 0, background: checked ? 'var(--swift-accent)' : 'var(--swift-border)', borderRadius: 12, transition: 'background 150ms cubic-bezier(0.175, 0.885, 0.32, 1.1)' }} />
      <span style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, background: '#FFF', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: checked ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 150ms cubic-bezier(0.175, 0.885, 0.32, 1.1)' }} />
    </label>
  );
}
