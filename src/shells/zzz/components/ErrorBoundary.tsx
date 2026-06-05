import React from 'react';
import { log } from '../../../shared/utils/logger';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });
    log('error', 'ErrorBoundary', error.message, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isDev = import.meta.env.DEV;
      const errorMessage = this.state.error?.message || 'An unexpected error occurred';
      const stackTrace = this.state.error?.stack || '';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className={styles.wrap}>
          <div className={styles.bar} />
          <div className={styles.title}>SYSTEM ERROR</div>
          <div className={styles.message}>{errorMessage}</div>
          <div className={styles.actions}>
            <button className={styles.retryBtn} onClick={this.handleRetry}>
              RETRY
            </button>
            <button
              className={styles.homeBtn}
              onClick={() => {
                this.handleRetry();
                window.location.hash = '#/';
              }}
            >
              RETURN HOME
            </button>
          </div>
          {isDev && (stackTrace || componentStack) && (
            <details className={styles.details}>
              <summary className={styles.summary}>Error Details</summary>
              {stackTrace && <pre className={styles.stack}>{stackTrace}</pre>}
              {componentStack && (
                <>
                  <div className={styles.stackLabel}>Component Stack:</div>
                  <pre className={styles.stack}>{componentStack}</pre>
                </>
              )}
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
