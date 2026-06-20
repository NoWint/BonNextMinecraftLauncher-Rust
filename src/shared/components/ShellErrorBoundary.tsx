import React from 'react';

interface Props {
  children: React.ReactNode;
  onFallback: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ShellErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Shell rendering error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0a0a0a',
          color: '#fff',
          fontFamily: '"SF Pro Display", "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif',
          gap: '1em',
        }}>
          <h2 style={{ color: '#ff4444', margin: 0 }}>Shell Error</h2>
          <p style={{ color: '#aaa', margin: 0, maxWidth: '30em', textAlign: 'center' }}>
            The current shell failed to render. You can switch back to the default shell.
          </p>
          <pre style={{
            color: '#888',
            fontSize: '0.8em',
            maxWidth: '40em',
            overflow: 'auto',
            background: '#111',
            padding: '1em',
            borderRadius: '4px',
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={this.props.onFallback}
            style={{
              padding: '0.6em 1.5em',
              background: '#ffe600',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Switch to Default Shell
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
