import React from 'react';
import styles from './ErrorBoundary.module.css';

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
        <div className={styles.wrap}>
          <div className={styles.bar} />
          <div className={styles.title}>SYSTEM ERROR</div>
          <div className={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button
            className={styles.homeBtn}
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.hash = '#/';
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
