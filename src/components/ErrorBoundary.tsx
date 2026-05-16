import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', background: '#0D0D0D', flexDirection: 'column', gap: 16,
        }}>
          <div style={{
            width: 4, height: 40, background: '#FF4444',
            clipPath: 'polygon(0 0, calc(100% - 2px) 0, 100% 2px, 100% 100%, 0 100%)',
          }} />
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: '1.2em',
            color: '#FF4444', letterSpacing: 4,
          }}>
            SYSTEM ERROR
          </div>
          <div style={{ fontSize: '0.55em', color: '#666', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.hash = '#/home';
            }}
            style={{
              background: '#1A1A1A', border: '1px solid #2A2A2A',
              color: '#FFF', padding: '8px 24px', cursor: 'pointer',
              fontSize: '0.6em', fontFamily: 'var(--font-body)',
              clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)',
            }}
          >
            RETURN HOME
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
