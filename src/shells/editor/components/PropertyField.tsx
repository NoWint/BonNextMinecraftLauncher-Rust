import type { PropSchema } from '../utils/schema';

interface PropertyFieldProps {
  schema: PropSchema;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

export function PropertyField({ schema, value, onChange }: PropertyFieldProps) {
  const handleChange = (newValue: unknown) => {
    onChange(schema.key, newValue);
  };

  switch (schema.type) {
    case 'string':
      return (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '10px', color: 'var(--editor-text-tertiary)', marginBottom: '2px', fontWeight: 600 }}>
            {schema.label}
          </label>
          <input
            type="text"
            value={String(value ?? schema.defaultValue)}
            onChange={e => handleChange(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'var(--editor-bg-tertiary)',
              border: '1px solid var(--editor-border)',
              borderRadius: '4px',
              color: 'var(--editor-text)',
              fontSize: '12px',
              outline: 'none',
              fontFamily: 'var(--editor-font-mono)',
            }}
          />
        </div>
      );

    case 'number':
      return (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '10px', color: 'var(--editor-text-tertiary)', marginBottom: '2px', fontWeight: 600 }}>
            {schema.label}
          </label>
          <input
            type="number"
            value={Number(value ?? schema.defaultValue)}
            onChange={e => handleChange(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'var(--editor-bg-tertiary)',
              border: '1px solid var(--editor-border)',
              borderRadius: '4px',
              color: 'var(--editor-text)',
              fontSize: '12px',
              outline: 'none',
            }}
          />
        </div>
      );

    case 'boolean':
      return (
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={Boolean(value ?? schema.defaultValue)}
            onChange={e => handleChange(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label style={{ fontSize: '11px', color: 'var(--editor-text)' }}>{schema.label}</label>
        </div>
      );

    case 'color':
      return (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '10px', color: 'var(--editor-text-tertiary)', marginBottom: '2px', fontWeight: 600 }}>
            {schema.label}
          </label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="color"
              value={String(value ?? schema.defaultValue)}
              onChange={e => handleChange(e.target.value)}
              style={{ width: '28px', height: '28px', border: 'none', cursor: 'pointer', padding: 0, background: 'transparent' }}
            />
            <input
              type="text"
              value={String(value ?? schema.defaultValue)}
              onChange={e => handleChange(e.target.value)}
              style={{
                flex: 1,
                padding: '4px 8px',
                background: 'var(--editor-bg-tertiary)',
                border: '1px solid var(--editor-border)',
                borderRadius: '4px',
                color: 'var(--editor-text)',
                fontSize: '12px',
                outline: 'none',
                fontFamily: 'var(--editor-font-mono)',
              }}
            />
          </div>
        </div>
      );

    case 'select':
      return (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '10px', color: 'var(--editor-text-tertiary)', marginBottom: '2px', fontWeight: 600 }}>
            {schema.label}
          </label>
          <select
            value={String(value ?? schema.defaultValue)}
            onChange={e => handleChange(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'var(--editor-bg-tertiary)',
              border: '1px solid var(--editor-border)',
              borderRadius: '4px',
              color: 'var(--editor-text)',
              fontSize: '12px',
              outline: 'none',
            }}
          >
            {schema.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );

    default:
      return null;
  }
}
