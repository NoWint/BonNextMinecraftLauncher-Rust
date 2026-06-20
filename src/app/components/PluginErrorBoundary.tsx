import React from 'react';

interface Props {
  pluginId?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class PluginErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[PluginErrorBoundary] Plugin "${this.props.pluginId ?? 'unknown'}" crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '1.5em', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '0.9em', marginBottom: '0.5em' }}>Plugin crashed</p>
          <p style={{ fontSize: '0.75em', color: 'var(--danger, #ff4444)' }}>
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              marginTop: '0.8em',
              padding: '0.4em 1em',
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              clipPath: 'var(--clip-small)',
              cursor: 'pointer',
              fontSize: '0.8em',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
